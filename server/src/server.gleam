import game
import gleam/bit_array
import gleam/bytes_tree
import gleam/erlang
import gleam/erlang/process.{type Subject}
import gleam/http
import gleam/http/cookie
import gleam/http/request
import gleam/http/response
import gleam/io
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import gleam/uri
import lustre/attribute
import lustre/element
import lustre/element/html
import mist.{type Connection, type ResponseData}
import shared.{type PlayerId, type PlayerName, PlayerId, PlayerName}

type WebsocketConnection {
  WebsocketConnection(id: shared.PlayerId)
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
  // SetupConnection(id: shared.PlayerId, room_code: RoomCode)
  // Sent to the actor from the state manager, which is then sent over the websocket.
  Request(shared.WebsocketRequest)
  // Sent to the actor to pass on to the state manager.
  Response(shared.WebsocketResponse)
  // Sent for the websocket connection to seppuku.
  Disconnect
}

fn not_found() {
  response.new(404)
  |> response.set_body(mist.Bytes(bytes_tree.new()))
}

fn bad_request(reason) {
  response.new(403)
  |> response.set_body(mist.Bytes(
    bytes_tree.from_string("Invalid request: ")
    |> bytes_tree.append(bit_array.from_string(reason)),
  ))
}

fn method_not_allowed() {
  response.new(405)
  |> response.set_body(mist.Bytes(bytes_tree.new()))
}

fn internal_error(reason) {
  response.new(500)
  |> response.set_body(mist.Bytes(
    bytes_tree.from_string("Internal error: ")
    |> bytes_tree.append(bit_array.from_string(reason)),
  ))
}

pub fn main() {
  let assert Ok(game) = game.start()

  let assert Ok(priv) = erlang.priv_directory("server")

  let assert Ok(_) =
    fn(req: request.Request(Connection)) -> response.Response(ResponseData) {
      case req.method {
        http.Options ->
          response.new(200)
          |> response.set_body(mist.Bytes(bytes_tree.new()))
          |> response.set_header(
            "Access-Control-Allow-Origin",
            "http://localhost:1234",
          )
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
                |> response.set_body(mist.Bytes(bytes_tree.new()))
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
                |> response.set_body(mist.Bytes(bytes_tree.new()))
              })

            ["ws", player_id, player_name] ->
              validate_player_name(game, player_id, player_name, fn() {
                mist.websocket(
                  request: req,
                  on_init: on_init(
                    _,
                    game,
                    PlayerId(player_id),
                    uri.percent_decode(player_name)
                      |> result.unwrap(player_name)
                      |> PlayerName,
                  ),
                  on_close: fn(websocket) {
                    process.send(websocket, Disconnect)
                  },
                  handler: handle_ws_message,
                )
              })
            ["createroom"] -> handle_create_room_request(game, req)
            ["joinroom"] -> handle_join_request(game, req)
            ["validatename"] -> handle_validate_name_request(game, req)

            _ ->
              response.new(200)
              |> response.prepend_header("content-type", "text/html")
              |> response.set_body(
                html.html([], [
                  html.head([], [
                    html.meta([attribute.attribute("charset", "UTF-8")]),
                    html.meta([
                      attribute.name("viewport"),
                      attribute.attribute(
                        "content",
                        "width=device-width, initial-scale=1.0",
                      ),
                    ]),
                    html.title([], "A Full Fridge"),
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
                |> bytes_tree.from_string_tree
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
    |> mist.bind("0.0.0.0")
    |> mist.port(8080)
    |> mist.start_http

  process.sleep_forever()
}

fn http_request_handler(
  req: request.Request(Connection),
  handle: fn(shared.HttpRequest) -> response.Response(ResponseData),
) {
  result.unwrap_both({
    use req <- result.try(
      mist.read_body(req, 1024 * 1024 * 10)
      |> result.map_error(fn(read_error) {
        case read_error {
          mist.ExcessBody -> bad_request("body too large")
          mist.MalformedBody -> bad_request("malformed request body")
        }
      }),
    )
    use body <- result.map(
      bit_array.to_string(req.body)
      |> result.replace_error(bad_request("invalid body")),
    )
    case shared.decode(body, shared.http_request_decoder()) {
      Ok(req) -> handle(req)
      Error(err) -> bad_request(err)
    }
  })
}

fn handle_create_room_request(
  game,
  _req: request.Request(Connection),
) -> response.Response(ResponseData) {
  process.call(game, game.CreateRoom, 2)
  |> result.map(fn(room) {
    response.new(200)
    |> response.set_cookie(
      "room_code",
      shared.room_code_to_string(room.0),
      cookie.Attributes(
        ..cookie.defaults(http.Https),
        max_age: Some(7200),
        path: None,
      ),
    )
    |> response.set_cookie(
      "player_id",
      shared.player_id_to_string(room.1),
      cookie.Attributes(
        ..cookie.defaults(http.Https),
        max_age: Some(7200),
        path: None,
      ),
    )
    |> response.set_body(mist.Bytes(
      shared.encode(
        shared.RoomResponse(room.0, room.1),
        shared.encode_http_response,
      )
      |> bytes_tree.from_string,
    ))
  })
  |> result.map_error(fn(_) { internal_error("creating room") })
  |> result.unwrap_both
}

fn handle_join_request(
  game,
  req: request.Request(Connection),
) -> response.Response(ResponseData) {
  use req <- http_request_handler(req)
  case req {
    shared.JoinRoomRequest(room_code) -> {
      process.try_call(game, game.GetRoom(_, room_code), 5)
      |> result.replace_error(internal_error("getting room"))
      |> result.try(fn(res) { result.replace_error(res, not_found()) })
      |> result.map(fn(_room) {
        case
          process.try_call(game, game.AddPlayerToRoom(_, room_code), 2)
          |> result.replace_error(internal_error("calling AddPlayerToRoom"))
        {
          Error(err) -> err
          Ok(Error(Nil)) -> internal_error("adding player to room")
          Ok(Ok(player_id)) -> {
            response.new(200)
            |> response.set_cookie(
              "room_code",
              shared.room_code_to_string(room_code),
              cookie.Attributes(
                ..cookie.defaults(http.Https),
                max_age: Some(7200),
                path: None,
              ),
            )
            |> response.set_cookie(
              "player_id",
              shared.player_id_to_string(player_id),
              cookie.Attributes(
                ..cookie.defaults(http.Https),
                max_age: Some(7200),
                path: None,
              ),
            )
            |> response.set_body(
              mist.Bytes(
                bytes_tree.from_string(shared.encode(
                  shared.RoomResponse(room_code, player_id),
                  shared.encode_http_response,
                )),
              ),
            )
          }
        }
      })
      |> result.unwrap_both
    }
    _ -> bad_request("invalid request")
  }
}

fn handle_validate_name_request(game, req) {
  use req <- http_request_handler(req)
  case req {
    shared.ValidateNameRequest(PlayerId(player_id), PlayerName(player_name)) ->
      validate_player_name(game, player_id, player_name, fn() {
        response.new(200)
        |> response.set_body(
          mist.Bytes(
            bytes_tree.from_string(shared.encode(
              shared.ValidateNameResponse(valid: True),
              shared.encode_http_response,
            )),
          ),
        )
      })
    _ -> bad_request("invalid request body")
  }
}

/// validate_player_name wraps a response in a check that the player name is
/// valid. If it is not valid, it replaces the wrapped response with an error
/// response.
fn validate_player_name(
  game: Subject(game.Msg),
  player_id: String,
  player_name: String,
  next: fn() -> response.Response(ResponseData),
) -> response.Response(ResponseData) {
  process.try_call(
    game,
    game.ValidateName(_, PlayerId(player_id), PlayerName(player_name)),
    5,
  )
  |> result.map(fn(valid) {
    case valid {
      Ok(_) -> next()
      Error(err) ->
        response.new(412)
        |> response.set_body(mist.Bytes(bytes_tree.from_string(err)))
    }
  })
  |> result.unwrap(
    response.new(500)
    |> response.set_body(mist.Bytes(bytes_tree.from_string("Internal error"))),
  )
}

fn on_init(
  _conn: mist.WebsocketConnection,
  game: Subject(game.Msg),
  player_id: PlayerId,
  player_name: PlayerName,
) -> #(
  Subject(WebsocketConnectionUpdate),
  Option(process.Selector(shared.WebsocketResponse)),
) {
  let self = process.new_subject()
  let assert Ok(connection_subject) =
    actor.start(WebsocketConnection(player_id), fn(update, connection_state) {
      case update {
        Request(req) -> {
          let WebsocketConnection(id) = connection_state
          process.send(
            game,
            game.ProcessWebsocketRequest(from: id, message: req),
          )
          actor.continue(connection_state)
        }
        Response(resp) -> {
          process.send(self, resp)
          actor.continue(connection_state)
        }
        Disconnect -> {
          case connection_state {
            WebsocketConnection(id) -> {
              process.send(game, game.Disconnect(id))
              io.println(
                "Player " <> shared.player_id_to_string(id) <> " disconnected.",
              )
            }
          }
          actor.Stop(process.Normal)
        }
      }
    })

  process.send(
    game,
    game.NewConnection(player_id, process.send(self, _), player_name),
  )

  #(
    connection_subject,
    Some(process.selecting(process.new_selector(), self, fn(a) { a })),
  )
}

fn handle_ws_message(
  websocket: Subject(WebsocketConnectionUpdate),
  conn: mist.WebsocketConnection,
  message: mist.WebsocketMessage(shared.WebsocketResponse),
) {
  case message {
    mist.Text(text) -> {
      io.println("Received request: " <> text)
      case shared.decode(text, shared.websocket_request_decoder()) {
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
        mist.send_text_frame(
          conn,
          shared.encode(response, shared.encode_websocket_response),
        )
      actor.continue(websocket)
    }
    mist.Binary(_) -> {
      actor.continue(websocket)
    }
    mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
  }
}
