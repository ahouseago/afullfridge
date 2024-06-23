import gleam/bit_array
import gleam/bytes_builder
import gleam/dict.{type Dict}
import gleam/erlang
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
import lustre/attribute
import lustre/element
import lustre/element/html
import mist.{type Connection, type ResponseData}
import prng/random
import prng/seed
import random_word
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

type RoomCodeGenerator {
  RoomCodeGenerator(generator: random.Generator(Int), seed: seed.Seed)
}

type StateWithSubject(connection_subject) {
  State(
    next_player_id: Int,
    room_code_generator: RoomCodeGenerator,
    players: Dict(ConnectionId, PlayerConnection),
    rooms: Dict(RoomCode, RoomState),
    connections: Dict(ConnectionId, fn(shared.WebsocketResponse) -> Nil),
  )
}

pub type RoomState {
  RoomState(room: shared.Room, round_state: Option(InProgressRound))
}

pub type InProgressRound {
  InProgressRound(
    words: List(String),
    leading_player_id: ConnectionId,
    submitted_word_lists: List(shared.PlayerWithOrderedPreferences),
  )
}

type State =
  StateWithSubject(ConnectionSubject)

fn get_next_player_id(state: State) {
  let id = state.next_player_id
  let connection_id = int.to_string(id)
  #(State(..state, next_player_id: id + 1), connection_id)
}

fn generate_room_code(state: State) {
  let #(utf_points, new_seed) =
    list.range(1, 4)
    |> list.fold(#([], state.room_code_generator.seed), fn(rolls, _) {
      let #(roll, new_seed) =
        random.step(state.room_code_generator.generator, rolls.1)
      let assert Ok(utf_point) = string.utf_codepoint(roll)
      #([utf_point, ..rolls.0], new_seed)
    })

  #(
    State(
      ..state,
      room_code_generator: RoomCodeGenerator(
        ..state.room_code_generator,
        seed: new_seed,
      ),
    ),
    string.from_utf_codepoints(utf_points),
  )
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
        next_player_id: 0,
        room_code_generator: RoomCodeGenerator(
          generator: random.int(65, 90),
          seed: seed.random(),
        ),
        players: dict.new(),
        rooms: dict.new(),
        connections: dict.new(),
      ),
      handle_message,
    )

  let assert Ok(priv) = erlang.priv_directory("server")

  let assert Ok(_) =
    fn(req: request.Request(Connection)) -> response.Response(ResponseData) {
      case req.method {
        http.Options ->
          response.new(200)
          |> response.set_body(mist.Bytes(bytes_builder.new()))
          |> response.set_header("Access-Control-Allow-Methods", "GET, POST")
          |> response.set_header("Access-Control-Allow-Headers", "content-type")
        http.Get | http.Post ->
          case request.path_segments(req) {
            ["client.mjs"] ->
              mist.send_file(
                priv <> "/static/client.mjs",
                offset: 0,
                limit: None,
              )
              |> result.map(fn(file) {
                response.new(200)
                |> response.prepend_header("content-type", "text/javascript")
                |> response.set_body(file)
              })
              |> result.lazy_unwrap(fn() {
                response.new(404)
                |> response.set_body(mist.Bytes(bytes_builder.new()))
              })

            ["client.css"] ->
              mist.send_file(
                priv <> "/static/client.css",
                offset: 0,
                limit: None,
              )
              |> result.map(fn(file) {
                response.new(200)
                |> response.prepend_header("content-type", "text/css")
                |> response.set_body(file)
              })
              |> result.lazy_unwrap(fn() {
                response.new(404)
                |> response.set_body(mist.Bytes(bytes_builder.new()))
              })

            ["lustre_ui.css"] ->
              mist.send_file(
                priv <> "/static/lustre_ui.css",
                offset: 0,
                limit: None,
              )
              |> result.map(fn(file) {
                response.new(200)
                |> response.prepend_header("content-type", "text/css")
                |> response.set_body(file)
              })
              |> result.lazy_unwrap(fn() {
                response.new(404)
                |> response.set_body(mist.Bytes(bytes_builder.new()))
              })

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

            _ ->
              response.new(200)
              |> response.prepend_header("content-type", "text/html")
              |> response.set_body(
                html.html([], [
                  html.head([], [
                    html.meta([attribute.attribute("charset", "UTF-8")]),
                    html.title([], "A Full Fridge"),
                    html.link([
                      attribute.rel("stylesheet"),
                      attribute.href("/lustre_ui.css"),
                    ]),
                    html.link([
                      attribute.rel("stylesheet"),
                      attribute.href("/client.css"),
                    ]),
                    html.script(
                      [attribute.type_("module"), attribute.src("/client.mjs")],
                      "",
                    ),
                  ]),
                  html.body([], [html.div([attribute.id("app")], [])]),
                ])
                |> element.to_document_string_builder
                |> bytes_builder.from_string_builder
                |> mist.Bytes,
              )
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
    |> mist.port(8080)
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
            Ok(room_state) -> {
              let room =
                Room(
                  ..room_state.room,
                  players: [
                    Player(id: id, name: player_name),
                    ..room_state.room.players
                  ],
                )
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              let room_state = RoomState(..room_state, room: room)
              dict.insert(state.rooms, room_code, room_state)
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
            Ok(room_state) -> {
              let room =
                Room(
                  ..room_state.room,
                  players: [
                    Player(id: id, name: player_name),
                    ..room_state.room.players
                  ],
                )
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              let room_state = RoomState(..room_state, room: room)
              dict.insert(state.rooms, room_code, room_state)
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
        |> result.try(fn(room_state) {
          let room =
            Room(
              ..room_state.room,
              players: list.filter(room_state.room.players, fn(player) {
                player.id != connection_id
              }),
            )
          broadcast_message(
            state.connections,
            room.players,
            shared.PlayersInRoom(room.players),
          )
          let room_state = RoomState(..room_state, room: room)
          Ok(dict.insert(state.rooms, room_state.room.room_code, room_state))
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
      let #(state, connection_id) = get_next_player_id(state)
      let #(state, room_code) = generate_room_code(state)
      let player = DisconnectedPlayer(id: connection_id, room_code: room_code)
      let room =
        Room(
          room_code: room_code,
          players: [],
          word_list: [],
          round: None,
          finished_rounds: [],
          scoring_method: shared.EqualPositions,
        )
      actor.send(subj, Ok(#(room_code, connection_id)))
      let room_state = RoomState(room: room, round_state: None)
      actor.continue(
        State(
          ..state,
          players: dict.insert(state.players, connection_id, player),
          rooms: dict.insert(state.rooms, room_code, room_state),
        ),
      )
    }
    GetRoom(subj, room_code) -> {
      case dict.get(state.rooms, room_code) {
        Ok(room_state) -> actor.send(subj, Ok(room_state.room))
        Error(_) -> Nil
      }
      actor.continue(state)
    }
    AddPlayerToRoom(subj, room_code) -> {
      result.map(dict.get(state.rooms, room_code), fn(room) {
        let #(state, connection_id) = get_next_player_id(state)
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
    shared.AddRandomWord -> {
      let new_state = add_word_to_room(state, room_code, random_word.new())
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    shared.RemoveWord(word) -> {
      let new_state = remove_word_from_room(state, room_code, word)
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    ListWords -> {
      let _ = list_words(state, room_code)
      state
    }
    StartRound -> {
      let new_state =
        result.map(dict.get(state.rooms, room_code), fn(room_state) {
          let room_state = start_new_round(state, room_state)
          State(..state, rooms: dict.insert(state.rooms, room_code, room_state))
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

fn get_next_leading_player(room_state: RoomState) -> shared.PlayerId {
  let players_count = list.length(room_state.room.players)
  // Reverse the list to start from the first player to join.
  let index =
    players_count - list.length(room_state.room.finished_rounds) % players_count

  let assert Ok(player) =
    room_state.room.players
    |> list.take(index)
    |> list.reverse
    |> list.first

  player.id
}

fn start_new_round(state: State, room_state: RoomState) -> RoomState {
  // Starting a round means:
  // - picking 5 words randomly
  let words = room_state.room.word_list |> list.shuffle |> list.take(5)
  // - picking a player to start
  let leading_player_id = get_next_leading_player(room_state)

  let in_progress_round = InProgressRound(words, leading_player_id, [])
  let round =
    shared.Round(
      in_progress_round.words,
      in_progress_round.leading_player_id,
      [],
    )

  let room = Room(..room_state.room, round: Some(round))

  // - sending round info to clients
  broadcast_message(state.connections, room.players, shared.RoundInfo(round))

  RoomState(round_state: Some(in_progress_round), room: room)
}

fn list_words(state: State, room_code: RoomCode) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  broadcast_message(
    state.connections,
    room_state.room.players,
    shared.WordList(room_state.room.word_list),
  )
}

fn add_word_to_room(state: State, room_code: RoomCode, word: String) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  // Remove duplicates
  let word_list = room_state.room.word_list |> list.filter(fn(w) { w != word })
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      RoomState(
        ..room_state,
        room: Room(..room_state.room, word_list: [word, ..word_list]),
      ),
    ),
  )
}

fn remove_word_from_room(state: State, room_code: RoomCode, word: String) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  // Remove word from list
  let word_list = room_state.room.word_list |> list.filter(fn(w) { w != word })
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      RoomState(
        ..room_state,
        room: Room(..room_state.room, word_list: word_list),
      ),
    ),
  )
}

fn submit_words(
  state: State,
  player: PlayerConnection,
  ordered_words: List(String),
) {
  use room_state <- result.map(dict.get(state.rooms, player.room_code))
  use round_state <- option.then(room_state.round_state)
  use round <- option.map(room_state.room.round)

  let lists_equal =
    list.sort(ordered_words, string.compare)
    == list.sort(round_state.words, string.compare)

  let #(round_state, round) = case lists_equal {
    False -> {
      let _ =
        dict.get(state.connections, player.id)
        |> result.map(fn(send_fn) {
          send_fn(shared.ServerError(
            "submitted words don't match the word list",
          ))
        })
      #(round_state, round)
    }
    True -> {
      #(
        InProgressRound(
          ..round_state,
          submitted_word_lists: [
            #(player.id, ordered_words),
            ..list.filter(round_state.submitted_word_lists, fn(words) {
              words.0 != player.id
            })
          ],
        ),
        Round(..round, submitted: [player.id, ..round.submitted]),
      )
    }
  }

  // Score round and move to the next round if everyone has submitted.
  let room_state = case
    list.length(round_state.submitted_word_lists)
    == list.length(room_state.room.players)
  {
    False ->
      RoomState(
        round_state: Some(round_state),
        room: Room(..room_state.room, round: Some(round)),
      )
    True -> {
      RoomState(
        ..room_state,
        room: Room(
          ..room_state.room,
          finished_rounds: [
            finish_round(state, room_state, round_state),
            ..room_state.room.finished_rounds
          ],
        ),
      )
      |> start_new_round(state, _)
    }
  }

  State(..state, rooms: dict.insert(state.rooms, player.room_code, room_state))
}

fn finish_round(
  state: State,
  room_state: RoomState,
  round: InProgressRound,
) -> shared.FinishedRound {
  let finished_round =
    shared.FinishedRound(
      words: round.words,
      leading_player_id: round.leading_player_id,
      player_scores: get_player_scores(
        room_state.room.players,
        round,
        score_round(room_state.room.scoring_method, round),
      ),
    )

  broadcast_message(
    state.connections,
    to: room_state.room.players,
    message: shared.RoundResult(finished_round),
  )

  finished_round
}

fn score_round(
  scoring_method: shared.ScoringMethod,
  round: InProgressRound,
) -> List(#(shared.PlayerId, Int)) {
  let correct_word_list =
    list.filter(round.submitted_word_lists, fn(word_list) {
      word_list.0 == round.leading_player_id
    })
    |> list.map(fn(player_with_preferences) { player_with_preferences.1 })
    |> list.first

  case scoring_method, correct_word_list {
    shared.ExactMatch, Ok(correct_word_list) ->
      exact_match_scores(round, correct_word_list)
    shared.EqualPositions, Ok(correct_word_list) ->
      equal_position_scores(round, correct_word_list)
    _, Error(_) -> no_score(round)
  }
}

// This is used when the leading player has left before submitting a word list:
// nobody can score.
fn no_score(round: InProgressRound) -> List(#(shared.PlayerId, Int)) {
  list.fold(round.submitted_word_lists, [], fn(scores, word_list) {
    [#(word_list.0, 0), ..scores]
  })
}

fn exact_match_scores(
  round: InProgressRound,
  correct_word_list: List(String),
) -> List(#(shared.PlayerId, Int)) {
  list.fold(round.submitted_word_lists, [], fn(scores, word_list) {
    let score = case
      round.leading_player_id != word_list.0
      && word_list.1 == correct_word_list
    {
      True -> #(word_list.0, 1)
      False -> #(word_list.0, 0)
    }
    [score, ..scores]
  })
}

fn equal_position_scores(
  round: InProgressRound,
  correct_word_list: List(String),
) -> List(#(shared.PlayerId, Int)) {
  list.fold(round.submitted_word_lists, [], fn(scores, word_list) {
    let score = case round.leading_player_id == word_list.0 {
      True -> 0
      False ->
        list.zip(correct_word_list, word_list.1)
        |> list.fold(0, fn(score, items) {
          case items.0 == items.1 {
            True -> score + 1
            False -> score
          }
        })
    }
    [#(word_list.0, score), ..scores]
  })
}

fn get_player_scores(
  players: List(shared.Player),
  round: InProgressRound,
  scores: List(#(shared.PlayerId, Int)),
) -> List(shared.PlayerScore) {
  let scores =
    list.fold(scores, dict.new(), fn(scores, score) {
      dict.insert(scores, score.0, score.1)
    })
  let player_map =
    list.fold(players, dict.new(), fn(player_names, player) {
      dict.insert(player_names, player.id, player)
    })

  list.map(round.submitted_word_lists, fn(word_list) {
    let player_name =
      dict.get(player_map, word_list.0)
      |> result.unwrap(shared.Player("", "Unknown"))
    let score = dict.get(scores, word_list.0) |> result.unwrap(0)
    shared.PlayerScore(player_name, word_list.1, score)
  })
}
