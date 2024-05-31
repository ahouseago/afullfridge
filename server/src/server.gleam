import gleam/bit_array
import gleam/bytes_builder
import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/http/request
import gleam/http/response
import gleam/int
import gleam/io
import gleam/list
import gleam/option.{None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import mist.{type Connection, type ResponseData}
import shared.{
  type Player, type PlayerName, type Room, type RoomCode, AddWord, ListWords,
  Player, Room, Round, StartRound, SubmitOrderedWords,
}

type ConnectionId =
  Int

// A subject for each websocket connection.
type ConnectionSubject =
  Subject(WebsocketConnectionUpdate)

type WebsocketConnection(connection_subject) {
  // Before the server has registered the new websocket and given it an ID,
  // it's in an initialising state where the connection to the client has been
  // established but the actor doesn't know who it is yet.
  Initialising(mist.WebsocketConnection)
  // Once the actor has been informed of who it is, this contains its state for
  // managing websocket communication.
  WebsocketConnection(
    id: ConnectionId,
    conn: mist.WebsocketConnection,
    room_code: RoomCode,
  )
}

type Message {
  NewConnection(
    connection_subject: ConnectionSubject,
    room_code: RoomCode,
    player_name: PlayerName,
  )
  DeleteConnection(ConnectionId, room_code: RoomCode)
  ProcessWebsocketRequest(from: ConnectionId, message: shared.WebsocketRequest)

  GetRoom(reply_with: Subject(Result(Room, Nil)), room_code: RoomCode)
  // GetPlayer(
  //   reqly_with: Subject(Result(PlayerConnection, Nil)),
  //   // TODO: maybe this is room code + player name
  //   id: ConnectionId,
  // )
  CreateRoom(reply_with: Subject(Result(#(Room, ConnectionId), Nil)))
  AddPlayerToRoom(
    reply_with: Subject(Result(#(Room, ConnectionId), String)),
    room_code: RoomCode,
  )
}

// Messages sent to each websocket actor to update its state or for
// communicating over its websocket.
type WebsocketConnectionUpdate {
  // Sent once set up so the websocket connection actor can set its internal state.
  SetupConnection(id: ConnectionId, room_code: RoomCode)
  // Sent to the actor from the state manager, which is then sent over the websocket.
  Request(shared.WebsocketRequest)
  // Sent to the actor to pass on to the state manager.
  Response(shared.WebsocketResponse)
  // Sent for the websocket connection to seppuku.
  Shutdown
}

type PlayerWithSubject(connection_subject) {
  // Before the websocket has been established
  DisconnectedPlayer(id: ConnectionId, name: String, room_code: RoomCode)
  ConnectedPlayer(
    id: ConnectionId,
    name: PlayerName,
    room_code: RoomCode,
    connection_subject: connection_subject,
  )
}

type PlayerConnection =
  PlayerWithSubject(ConnectionSubject)

type StateWithSubject(connection_subject) {
  State(
    next_id: ConnectionId,
    rooms: Dict(RoomCode, Room),
    connections: Dict(ConnectionId, PlayerWithSubject(connection_subject)),
  )
}

type State =
  StateWithSubject(ConnectionSubject)

fn get_next_id(state: State) {
  let id = state.next_id
  #(State(..state, next_id: id + 1), id)
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
      State(next_id: 0, rooms: dict.new(), connections: dict.new()),
      handle_message,
    )

  let assert Ok(_) =
    fn(req: request.Request(Connection)) -> response.Response(ResponseData) {
      case request.path_segments(req) {
        ["ws", room_code, player_name] ->
          mist.websocket(
            request: req,
            on_init: on_init(state_subject, room_code, player_name),
            on_close: fn(ws_conn_subject) {
              process.send(ws_conn_subject, Shutdown)
            },
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
      |> response.set_header("Access-Control-Allow-Origin", "http://localhost:1234")
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
        use join_room_call <- result.try(
          process.try_call(state_subject, AddPlayerToRoom(_, room_code), 2)
          |> result.map_error(fn(_call_error) {
            internal_error("adding player to room")
          }),
        )
        use join_room <- result.map(
          join_room_call
          |> result.map_error(fn(reason) { internal_error(reason) }),
        )
        let #(room, player_id) = join_room
        response.new(200)
        |> response.set_body(
          mist.Bytes(
            bytes_builder.from_string(
              shared.encode_http_response(shared.RoomResponse(room, player_id)),
            ),
          ),
        )
      })
    }
    Error(reason) -> Error(bad_request(reason))
    _ -> Error(bad_request("invalid request"))
  }
}

fn on_init(state_subj, room_code, player_name) {
  fn(conn) {
    let selector = process.new_selector()
    let assert Ok(connection_subject) =
      // TODO: check that the player is in the room before allowing this websocket
      // connection to be set up.
      actor.start(
        Initialising(conn),
        fn(update: WebsocketConnectionUpdate, connection_state) {
          case update {
            SetupConnection(id, room_code) -> {
              io.println(
                "New connection: "
                <> int.to_string(id)
                <> " has connected to room "
                <> room_code
                <> ".",
              )
              actor.continue(WebsocketConnection(id, conn, room_code))
            }
            Request(req) -> {
              case connection_state {
                WebsocketConnection(id, _, _) -> {
                  process.send(
                    state_subj,
                    ProcessWebsocketRequest(from: id, message: req),
                  )
                  actor.continue(connection_state)
                }
                _ -> actor.continue(connection_state)
              }
            }
            Response(outgoing_message) -> {
              let assert Ok(_) =
                mist.send_text_frame(
                  conn,
                  shared.encode_websocket_response(outgoing_message),
                )
              actor.continue(connection_state)
            }
            Shutdown -> {
              case connection_state {
                WebsocketConnection(id, _, room_code) -> {
                  process.send(state_subj, DeleteConnection(id, room_code))
                  io.println(
                    "Connection "
                    <> int.to_string(id)
                    <> " left room "
                    <> room_code
                    <> ".",
                  )
                }
                _ -> Nil
              }
              actor.Stop(process.Normal)
            }
          }
        },
      )

    process.send(
      state_subj,
      NewConnection(connection_subject, room_code, player_name),
    )

    #(connection_subject, Some(selector))
  }
}

fn handle_ws_message(ws_conn_subject, conn, message) {
  case message {
    mist.Text("ping") -> {
      let assert Ok(_) = mist.send_text_frame(conn, "pong")
      actor.continue(ws_conn_subject)
    }
    mist.Text(text) -> {
      io.println("Received request: " <> text)
      let req = shared.decode_websocket_request(text)
      case req {
        Ok(req) -> process.send(ws_conn_subject, Request(req))
        Error(err) -> {
          let _ = mist.send_text_frame(conn, "invalid request: " <> err)
          io.println("invalid request: " <> err)
        }
      }
      actor.continue(ws_conn_subject)
    }
    mist.Binary(_) | mist.Custom(_) -> {
      actor.continue(ws_conn_subject)
    }
    mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
  }
}

fn handle_message(msg: Message, state: State) -> actor.Next(Message, State) {
  case msg {
    NewConnection(subject, room_code, player_name) -> {
      // TODO: make this check whether the player is already in the room and
      // return the player?
      let #(state, id) = get_next_id(state)
      process.send(subject, SetupConnection(id, room_code))
      let rooms = case dict.get(state.rooms, room_code) {
        Ok(room) -> {
          dict.insert(
            state.rooms,
            room_code,
            Room(
              ..room,
              players: dict.insert(
                room.players,
                id,
                Player(id: id, name: player_name),
              ),
            ),
          )
        }
        Error(_) -> state.rooms
      }
      actor.continue(
        State(
          ..state,
          rooms: rooms,
          connections: dict.insert(
            state.connections,
            id,
            ConnectedPlayer(id, player_name, room_code, subject),
          ),
        ),
      )
    }
    DeleteConnection(connection_id, room_code) -> {
      let rooms = case dict.get(state.rooms, room_code) {
        Ok(room) -> {
          dict.insert(
            state.rooms,
            room_code,
            Room(..room, players: dict.delete(room.players, connection_id)),
          )
        }
        Error(_) -> state.rooms
      }
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
      let room_code =
        dict.size(state.rooms)
        |> int.to_string
      let connection =
        DisconnectedPlayer(id: connection_id, name: "", room_code: room_code)
      let player = Player(id: connection_id, name: "")
      let room =
        Room(
          room_code: room_code,
          players: dict.new()
            |> dict.insert(connection_id, player),
          word_list: [],
          round: None,
        )
      actor.send(subj, Ok(#(room, connection_id)))
      actor.continue(
        State(
          ..state,
          connections: dict.insert(state.connections, connection_id, connection),
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
    // GetPlayer(subj, id) -> todo
    AddPlayerToRoom(subj, room_code) -> {
      result.map(dict.get(state.rooms, room_code), fn(room) {
        let #(state, connection_id) = get_next_id(state)
        let connection =
          DisconnectedPlayer(id: connection_id, name: "", room_code: room_code)
        let player = Player(id: connection_id, name: "")
        let room =
          Room(
            ..room,
            players: room.players
              |> dict.insert(connection_id, player),
          )
        actor.send(subj, Ok(#(room, connection_id)))
        actor.continue(
          State(
            ..state,
            connections: dict.insert(
              state.connections,
              connection_id,
              connection,
            ),
            rooms: dict.insert(state.rooms, room_code, room),
          ),
        )
      })
      |> result.unwrap(actor.continue(state))
    }
  }
}

fn handle_websocket_request(
  state: State,
  from: ConnectionId,
  request: shared.WebsocketRequest,
) -> Result(State, Nil) {
  use player <- result.map(dict.get(state.connections, from))

  case request {
    AddWord(word) -> {
      let new_state = add_word_to_room(state, player.room_code, word)
      let _ = result.try(new_state, list_words(_, player.room_code))
      result.unwrap(new_state, state)
    }
    ListWords -> {
      let _ = list_words(state, player.room_code)
      state
    }
    StartRound -> {
      state
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
  use p <- list.each(
    room.players
    |> dict.values,
  )
  use conn <- result.map(dict.get(state.connections, p.id))
  case conn {
    ConnectedPlayer(_, _, _, connection_subject) ->
      process.send(
        connection_subject,
        Response(shared.WordList(room.word_list)),
      )
    _ -> Nil
  }
}

fn add_word_to_room(state: State, room_code: RoomCode, word: String) {
  use room <- result.map(dict.get(state.rooms, room_code))
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      Room(..room, word_list: [word, ..room.word_list]),
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

  let lists_equal = list.sort(ordered_words, string.compare) == round.words
  let is_leading = { round.leading_player.0 }.id == player.id

  let new_round = case lists_equal, is_leading {
    False, _ -> {
      case player {
        ConnectedPlayer(_, _, _, connection_subject) ->
          process.send(
            connection_subject,
            Response(shared.ServerError(
              "submitted words don't match the word list",
            )),
          )
        _ -> Nil
      }
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
