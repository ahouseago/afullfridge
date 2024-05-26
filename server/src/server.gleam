import gleam/bytes_builder
import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/int
import gleam/io
import gleam/list
import gleam/option.{Some}
import gleam/otp/actor
import gleam/result
import mist.{type Connection, type ResponseData}
import shared.{AddWord, ListWords, StartRound, SubmitOrderedWords}

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
    room_code: String,
  )
}

type WebsocketEvent {
  NewConnection(
    connection_subject: ConnectionSubject,
    room_code: String,
    player_name: String,
  )
  DeleteConnection(ConnectionId, room_code: String)
  ProcessRequest(from: ConnectionId, message: shared.Request)
}

// Messages sent to each websocket actor to update its state or for
// communicating over its websocket.
type WebsocketConnectionUpdate {
  // Sent once set up so the websocket connection actor can set its internal state.
  SetupConnection(id: ConnectionId, room_code: String)
  // Sent to the actor from the state manager, which is then sent over the websocket.
  Request(shared.Request)
  // Sent to the actor to pass on to the state manager.
  Response(shared.Response)
  // Sent for the websocket connection to seppuku.
  Shutdown
}

type ConnectedPlayer(connection_subject) {
  ConnectedPlayer(
    id: ConnectionId,
    name: String,
    room_code: String,
    connection_subject: connection_subject,
  )
}

type State(connection_subject) {
  State(
    next_id: ConnectionId,
    rooms: Dict(String, shared.Room),
    connections: Dict(ConnectionId, ConnectedPlayer(connection_subject)),
  )
}

fn get_next_id(state: State(a)) {
  let id = state.next_id
  #(State(..state, next_id: id + 1), id)
}

pub fn main() {
  // These values are for the Websocket process initialized below
  // let selector = process.new_selector()
  let assert Ok(state_subject) =
    actor.start(
      State(next_id: 0, rooms: dict.new(), connections: dict.new()),
      handle_message,
    )

  let not_found =
    response.new(404)
    |> response.set_body(mist.Bytes(bytes_builder.new()))

  let assert Ok(_) =
    fn(req: Request(Connection)) -> Response(ResponseData) {
      case request.path_segments(req) {
        ["ws", room_code, player_name] ->
          mist.websocket(
            request: req,
            on_init: on_init(state_subject, room_code, player_name),
            on_close: fn(ws_conn_subject) {
              actor.send(ws_conn_subject, Shutdown)
            },
            handler: handle_ws_message,
          )

        _ -> not_found
      }
    }
    |> mist.new
    |> mist.port(3000)
    |> mist.start_http

  process.sleep_forever()
}

fn on_init(state_subj, room_code, player_name) {
  fn(conn) {
    let selector = process.new_selector()
    let assert Ok(connection_subject) =
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
                  actor.send(state_subj, ProcessRequest(from: id, message: req))
                  actor.continue(connection_state)
                }
                _ -> actor.continue(connection_state)
              }
            }
            Response(outgoing_message) -> {
              let assert Ok(_) =
                mist.send_text_frame(
                  conn,
                  shared.encode_response(outgoing_message),
                )
              actor.continue(connection_state)
            }
            Shutdown -> {
              case connection_state {
                WebsocketConnection(id, _, room_code) -> {
                  actor.send(state_subj, DeleteConnection(id, room_code))
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

    actor.send(
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
      let req = shared.decode_request(text)
      case req {
        Ok(req) -> actor.send(ws_conn_subject, Request(req))
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

fn handle_message(
  event: WebsocketEvent,
  state: State(ConnectionSubject),
) -> actor.Next(WebsocketEvent, State(ConnectionSubject)) {
  case event {
    NewConnection(subject, room_code, player_name) -> {
      let #(state, id) = get_next_id(state)
      actor.send(subject, SetupConnection(id, room_code))
      let rooms = case dict.get(state.rooms, room_code) {
        Ok(room) -> {
          dict.insert(
            state.rooms,
            room_code,
            shared.Room(
              ..room,
              players: [
                shared.Player(id: id, name: player_name),
                ..room.players
              ],
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
            shared.Room(
              ..room,
              players: list.filter(room.players, keeping: fn(player) {
                player.id == connection_id
              }),
            ),
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
    ProcessRequest(from, request) -> {
      actor.continue(
        handle_request(state, from, request)
        |> result.unwrap(state),
      )
    }
  }
}

fn handle_request(
  state: State(ConnectionSubject),
  from: ConnectionId,
  request: shared.Request,
) -> Result(State(ConnectionSubject), Nil) {
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
    _ -> state
  }
}

fn list_words(state: State(ConnectionSubject), room_code: String) {
  use room <- result.map(dict.get(state.rooms, room_code))
  use p <- list.each(room.players)
  use conn <- result.map(dict.get(state.connections, p.id))
  actor.send(conn.connection_subject, Response(shared.WordList(room.word_list)))
}

fn add_word_to_room(
  state: State(ConnectionSubject),
  room_code: String,
  word: String,
) {
  use room <- result.map(dict.get(state.rooms, room_code))
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      shared.Room(..room, word_list: [word, ..room.word_list]),
    ),
  )
}
