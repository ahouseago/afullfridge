import gleam/bit_array
import gleam/bytes_builder
import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/int
import gleam/io
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import mist.{type Connection, type ResponseData}
import shared.{
  type Player, type PlayerName, type Room, type RoomCode, AddWord, ListWords,
  Player, Room, Round, StartRound, SubmitOrderedWords,
}

type ConnectionId =
  String

// A subject for each websocket connection.
type ConnectionSubject =
  Subject(WebsocketConnectionUpdate)

type WebsocketConnection {
  WebsocketConnection(id: ConnectionId)
}

// These messages are the ways to communicate with the game state actor.
type Message {
  NewConnection(
    player_id: ConnectionId,
    send_message: fn(shared.WebsocketResponse) -> Nil,
    player_name: PlayerName,
  )
  DeleteConnection(ConnectionId)
  ProcessWebsocketRequest(from: ConnectionId, message: shared.WebsocketRequest)

  GetRoom(reply_with: Subject(Result(Room, Nil)), room_code: RoomCode)
  CreateRoom(reply_with: Subject(Result(#(RoomCode, ConnectionId), Nil)))
  AddPlayerToRoom(
    reply_with: Subject(Result(ConnectionId, String)),
    room_code: RoomCode,
  )
}

// Handling new connections:
// CreateRoom -> Generates a room with no players in state.rooms
// JoinRoom(room_code) -> creates a player with an id, creates a disconnected
//   player in state.players with the room code. Returns the player_id
// Connect(player_id, name) -> looks up the player_id in state.players to get
//   the room to connect them to, then adds them to that room.

// Messages sent to each websocket actor to update its state or for
// communicating over its websocket.
type WebsocketConnectionUpdate {
  // Sent once set up so the websocket connection actor can set its internal state.
  // SetupConnection(id: ConnectionId, room_code: RoomCode)
  // Sent to the actor from the state manager, which is then sent over the websocket.
  Request(shared.WebsocketRequest)
  // Sent to the actor to pass on to the state manager.
  Response(shared.WebsocketResponse)
  // Sent for the websocket connection to seppuku.
  Shutdown
}

type PlayerConnection {
  // Before the websocket has been established
  DisconnectedPlayer(id: ConnectionId, room_code: RoomCode)
  ConnectedPlayer(id: ConnectionId, room_code: RoomCode, name: PlayerName)
}

type StateWithSubject(connection_subject) {
  State(
    next_id: Int,
    players: Dict(ConnectionId, PlayerConnection),
    rooms: Dict(RoomCode, Room),
    connections: Dict(ConnectionId, fn(shared.WebsocketResponse) -> Nil),
  )
}

type State =
  StateWithSubject(ConnectionSubject)

fn get_next_id(state: State) {
  let id = state.next_id
  let connection_id = int.to_string(id)
  #(State(..state, next_id: id + 1), connection_id)
}

fn not_found() {
  response.new(404)
  |> response.set_body(mist.Bytes(bytes_builder.new()))
}

fn bad_request(reason) {
  response.new(403)
  |> response.set_body(mist.Bytes(
    bytes_builder.from_string("Invalid request: ")
    |> bytes_builder.append(bit_array.from_string(reason)),
  ))
}

fn method_not_allowed() {
  response.new(405)
  |> response.set_body(mist.Bytes(bytes_builder.new()))
}

fn internal_error(reason) {
  response.new(500)
  |> response.set_body(mist.Bytes(
    bytes_builder.from_string("Internal error: ")
    |> bytes_builder.append(bit_array.from_string(reason)),
  ))
}

pub fn main() {
  // These values are for the Websocket process initialized below
  let assert Ok(state_subject) =
    actor.start(
      State(
        next_id: 0,
        players: dict.new(),
        rooms: dict.new(),
        connections: dict.new(),
      ),
      handle_message,
    )

  let assert Ok(_) =
    fn(req: request.Request(Connection)) -> response.Response(ResponseData) {
      case req.method {
        http.Options ->
          response.new(200)
          |> response.set_body(mist.Bytes(bytes_builder.new()))
          |> response.set_header(
            "Access-Control-Allow-Origin",
            "http://localhost:1234",
          )
          |> response.set_header("Access-Control-Allow-Methods", "GET, POST")
          |> response.set_header("Access-Control-Allow-Headers", "content-type")
        http.Get | http.Post ->
          case request.path_segments(req) {
            ["ws", player_id, player_name] ->
              mist.websocket(
                request: req,
                on_init: on_init(state_subject, player_id, player_name),
                on_close: fn(websocket) { process.send(websocket, Shutdown) },
                handler: handle_ws_message,
              )
            ["createroom"] ->
              handle_create_room_request(state_subject, req)
              |> result.unwrap_both
            ["joinroom"] -> {
              handle_join_request(state_subject, req)
              |> result.unwrap_both
            }

            _ -> not_found()
          }
          |> response.set_header(
            "Access-Control-Allow-Origin",
            "http://localhost:1234",
          )
          |> response.set_header("Access-Control-Allow-Methods", "GET, POST")
          |> response.set_header("Access-Control-Allow-Headers", "content-type")
        _ -> method_not_allowed()
      }
    }
    |> mist.new
    |> mist.port(3000)
    |> mist.start_http

  process.sleep_forever()
}

fn handle_create_room_request(
  state_subject,
  _req: request.Request(Connection),
) -> Result(response.Response(ResponseData), response.Response(ResponseData)) {
  process.try_call(state_subject, CreateRoom, 2)
  |> result.map_error(fn(_call_result) {
    internal_error("failed to create room")
  })
  |> result.try(fn(create_room_result) {
    result.map(create_room_result, fn(room) {
      response.new(200)
      |> response.set_body(mist.Bytes(
        shared.encode_http_response(shared.RoomResponse(room.0, room.1))
        |> bytes_builder.from_string,
      ))
    })
    |> result.map_error(fn(_) { internal_error("creating room") })
  })
}

fn handle_join_request(
  state_subject,
  req: request.Request(Connection),
) -> Result(response.Response(ResponseData), response.Response(ResponseData)) {
  use req <- result.try(
    mist.read_body(req, 1024 * 1024 * 10)
    |> result.map_error(fn(read_error) {
      case read_error {
        mist.ExcessBody -> bad_request("body too large")
        mist.MalformedBody -> bad_request("malformed request body")
      }
    }),
  )
  use body <- result.try(
    bit_array.to_string(req.body)
    |> result.map_error(fn(_) { bad_request("invalid body") }),
  )

  case shared.decode_http_request(body) {
    Ok(shared.JoinRoomRequest(room_code)) -> {
      process.try_call(state_subject, GetRoom(_, room_code), 5)
      |> result.map_error(fn(_) { not_found() })
      |> result.try(fn(_room) {
        use join_room <- result.try(
          process.try_call(state_subject, AddPlayerToRoom(_, room_code), 2)
          |> result.map_error(fn(_call_error) {
            internal_error("adding player to room")
          }),
        )
        use connection_id <- result.map(
          join_room
          |> result.map_error(fn(reason) { internal_error(reason) }),
        )
        response.new(200)
        |> response.set_body(
          mist.Bytes(
            bytes_builder.from_string(
              shared.encode_http_response(shared.RoomResponse(
                room_code,
                connection_id,
              )),
            ),
          ),
        )
      })
    }
    Error(reason) -> Error(bad_request(reason))
    _ -> Error(bad_request("invalid request"))
  }
}

fn on_init(
  game: Subject(Message),
  connection_id: ConnectionId,
  player_name: String,
) {
  fn(_conn: mist.WebsocketConnection) -> #(
    Subject(WebsocketConnectionUpdate),
    Option(process.Selector(shared.WebsocketResponse)),
  ) {
    let self = process.new_subject()
    let assert Ok(connection_subject) =
      actor.start(
        WebsocketConnection(connection_id),
        fn(update, connection_state) {
          case update {
            Request(req) -> {
              let WebsocketConnection(id) = connection_state
              process.send(
                game,
                ProcessWebsocketRequest(from: id, message: req),
              )
              actor.continue(connection_state)
            }
            Response(resp) -> {
              process.send(self, resp)
              actor.continue(connection_state)
            }
            Shutdown -> {
              case connection_state {
                WebsocketConnection(id) -> {
                  process.send(game, DeleteConnection(id))
                  io.println("Player " <> id <> " disconnected.")
                }
              }
              actor.Stop(process.Normal)
            }
          }
        },
      )

    process.send(
      game,
      NewConnection(connection_id, process.send(self, _), player_name),
    )

    #(
      connection_subject,
      Some(process.selecting(process.new_selector(), self, fn(a) { a })),
    )
  }
}

fn handle_ws_message(
  websocket: Subject(WebsocketConnectionUpdate),
  conn: mist.WebsocketConnection,
  message: mist.WebsocketMessage(shared.WebsocketResponse),
) {
  case message {
    mist.Text(text) -> {
      io.println("Received request: " <> text)
      let req = shared.decode_websocket_request(text)
      case req {
        Ok(req) -> process.send(websocket, Request(req))
        Error(err) -> {
          let _ = mist.send_text_frame(conn, "invalid request: " <> err)
          io.println("invalid request: " <> err)
        }
      }
      actor.continue(websocket)
    }
    mist.Custom(response) -> {
      let assert Ok(_) =
        mist.send_text_frame(conn, shared.encode_websocket_response(response))
      actor.continue(websocket)
    }
    mist.Binary(_) -> {
      actor.continue(websocket)
    }
    mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
  }
}

fn handle_message(msg: Message, state: State) -> actor.Next(Message, State) {
  case msg {
    NewConnection(connection_id, send_fn, player_name) -> {
      case dict.get(state.players, connection_id) {
        Ok(DisconnectedPlayer(id, room_code)) -> {
          io.println(
            "player "
            <> id
            <> " set up websocket connection in room "
            <> room_code
            <> ".",
          )
          let connections = dict.insert(state.connections, id, send_fn)
          let players =
            dict.insert(
              state.players,
              id,
              ConnectedPlayer(id, room_code, player_name),
            )
          let rooms = case dict.get(state.rooms, room_code) {
            Ok(room) -> {
              let room =
                Room(
                  ..room,
                  players: [Player(id: id, name: player_name), ..room.players],
                )
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              dict.insert(state.rooms, room_code, room)
            }
            Error(_) -> state.rooms
          }
          actor.continue(
            State(
              ..state,
              players: players,
              rooms: rooms,
              connections: connections,
            ),
          )
        }
        Ok(ConnectedPlayer(id, room_code, player_name)) -> {
          let connections = dict.insert(state.connections, id, send_fn)
          let rooms = case dict.get(state.rooms, room_code) {
            Ok(room) -> {
              let room =
                Room(
                  ..room,
                  players: [Player(id: id, name: player_name), ..room.players],
                )
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              dict.insert(state.rooms, room_code, room)
            }
            Error(_) -> state.rooms
          }
          actor.continue(State(..state, rooms: rooms, connections: connections))
        }
        Error(Nil) -> {
          io.println("found error when getting player for new connection")
          actor.continue(state)
        }
      }
    }
    DeleteConnection(connection_id) -> {
      let rooms =
        dict.get(state.players, connection_id)
        |> result.map(fn(player) { player.room_code })
        |> result.try(fn(room_code) { dict.get(state.rooms, room_code) })
        |> result.try(fn(room) {
          let room =
            Room(
              ..room,
              players: list.filter(room.players, fn(player) {
                player.id != connection_id
              }),
            )
          broadcast_message(
            state.connections,
            room.players,
            shared.PlayersInRoom(room.players),
          )
          Ok(dict.insert(state.rooms, room.room_code, room))
        })
        |> result.unwrap(state.rooms)
      actor.continue(
        State(
          ..state,
          rooms: rooms,
          connections: dict.delete(state.connections, connection_id),
        ),
      )
    }
    ProcessWebsocketRequest(from, request) -> {
      actor.continue(
        handle_websocket_request(state, from, request)
        |> result.unwrap(state),
      )
    }
    CreateRoom(subj) -> {
      let #(state, connection_id) = get_next_id(state)
      // TODO: make room codes that aren't just incrementing integers.
      let room_code =
        dict.size(state.rooms)
        |> int.to_string
      let player = DisconnectedPlayer(id: connection_id, room_code: room_code)
      let room =
        Room(room_code: room_code, players: [], word_list: [], round: None)
      actor.send(subj, Ok(#(room_code, connection_id)))
      actor.continue(
        State(
          ..state,
          players: dict.insert(state.players, connection_id, player),
          rooms: dict.insert(state.rooms, room_code, room),
        ),
      )
    }
    GetRoom(subj, room_code) -> {
      case dict.get(state.rooms, room_code) {
        Ok(room) -> actor.send(subj, Ok(room))
        Error(_) -> Nil
      }
      actor.continue(state)
    }
    AddPlayerToRoom(subj, room_code) -> {
      result.map(dict.get(state.rooms, room_code), fn(room) {
        let #(state, connection_id) = get_next_id(state)
        let player_connection =
          DisconnectedPlayer(id: connection_id, room_code: room_code)
        actor.send(subj, Ok(connection_id))
        actor.continue(
          State(
            ..state,
            players: dict.insert(
              state.players,
              connection_id,
              player_connection,
            ),
            rooms: dict.insert(state.rooms, room_code, room),
          ),
        )
      })
      |> result.unwrap(actor.continue(state))
    }
  }
}

fn broadcast_message(
  connections: Dict(ConnectionId, fn(shared.WebsocketResponse) -> Nil),
  to players: List(Player),
  message msg: shared.WebsocketResponse,
) {
  use player <- list.each(players)
  use send_fn <- result.map(dict.get(connections, player.id))
  send_fn(msg)
}

fn handle_websocket_request(
  state: State,
  from: ConnectionId,
  request: shared.WebsocketRequest,
) -> Result(State, Nil) {
  use player <- result.map(dict.get(state.players, from))
  let room_code = player.room_code
  case request {
    AddWord(word) -> {
      let new_state = add_word_to_room(state, room_code, word)
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    ListWords -> {
      let _ = list_words(state, room_code)
      state
    }
    StartRound -> {
      let new_state =
        result.map(dict.get(state.rooms, room_code), fn(room) {
          // Starting a round means:
          // - picking 5 words randomly (how do I do random things?)
          let words = room.word_list |> list.shuffle |> list.take(5)
          // - picking a player to start
          let assert [leading_player, ..other_players] =
            room.players |> list.map(fn(player) { #(player, []) })
          let round = shared.Round(words, leading_player, other_players)

          let room = Room(..room, round: Some(round))

          // - sending round info to clients
          broadcast_message(
            state.connections,
            room.players,
            shared.RoundInfo(round),
          )
          State(..state, rooms: dict.insert(state.rooms, room_code, room))
        })
      result.unwrap(new_state, state)
    }
    SubmitOrderedWords(ordered_words) -> {
      submit_words(state, player, ordered_words)
      |> result.unwrap(None)
      |> option.unwrap(state)
    }
  }
}

fn list_words(state: State, room_code: RoomCode) {
  use room <- result.map(dict.get(state.rooms, room_code))
  broadcast_message(
    state.connections,
    room.players,
    shared.WordList(room.word_list),
  )
}

fn add_word_to_room(state: State, room_code: RoomCode, word: String) {
  use room <- result.map(dict.get(state.rooms, room_code))
  // Remove duplicates
  let word_list = room.word_list |> list.filter(fn(w) { w != word })
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      Room(..room, word_list: [word, ..word_list]),
    ),
  )
}

fn submit_words(
  state: State,
  player: PlayerConnection,
  ordered_words: List(String),
) {
  use room <- result.map(dict.get(state.rooms, player.room_code))
  use round <- option.map(room.round)

  let lists_equal =
    list.sort(ordered_words, string.compare)
    == list.sort(round.words, string.compare)
  let is_leading = { round.leading_player.0 }.id == player.id

  let new_round = case lists_equal, is_leading {
    False, _ -> {
      let _ =
        dict.get(state.connections, player.id)
        |> result.map(fn(send_fn) {
          send_fn(shared.ServerError(
            "submitted words don't match the word list",
          ))
        })
      round
    }
    True, True -> {
      Round(..round, leading_player: #(round.leading_player.0, ordered_words))
    }
    True, False -> {
      Round(
        ..round,
        other_players: list.map(round.other_players, fn(p) {
          case { p.0 }.id == player.id {
            True -> #(p.0, ordered_words)
            False -> p
          }
        }),
      )
    }
  }

  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      player.room_code,
      Room(..room, round: Some(new_round)),
    ),
  )
}
