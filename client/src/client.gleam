import gleam/bit_array
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/order
import gleam/result
import gleam/string
import gleam/uri
import icon
import lustre
import lustre/attribute.{class}
import lustre/effect
import lustre/element
import lustre/element/html
import lustre/event
import lustre_http
import lustre_websocket as ws
import modem
import plinth/browser/clipboard
import plinth/javascript/storage
import shared.{
  type PlayerId, type PlayerName, type RoomCode, PlayerId, PlayerName, RoomCode,
}

pub type Model {
  NotInRoom(
    uri: uri.Uri,
    route: Route,
    room_code_input: String,
    join_room_err: Option(String),
  )
  InRoom(
    uri: uri.Uri,
    player_id: PlayerId,
    room_code: RoomCode,
    player_name: PlayerName,
    active_game: Option(ActiveGame),
    display_state: DisplayState,
    error: Option(String),
  )
}

pub type ActiveGame {
  ActiveGame(
    ws: ws.WebSocket,
    room: Option(shared.Room),
    round: Option(RoundState),
    add_word_input: String,
  )
}

pub type InGameView {
  Round
  Scores
  WordList
}

pub type DisplayState {
  DisplayState(view: InGameView, menu_open: Bool)
}

pub type RoundState {
  RoundState(round: shared.Round, ordered_words: List(String), submitted: Bool)
}

pub type Route {
  Home
  Play(room_code: Option(String))
  NotFound
}

pub type Msg {
  OnRouteChange(uri: uri.Uri, route: Route)

  WebSocketEvent(ws.WebSocketEvent)
  OnWebsocketMessage(shared.WebsocketResponse)

  StartGame
  JoinGame
  JoinedRoom(Result(shared.HttpResponse, lustre_http.HttpError))
  NameIsValid(Result(shared.HttpResponse, lustre_http.HttpError))
  LeaveGame

  // Display actions
  ShowMenu(Bool)
  SetView(InGameView)
  CopyRoomCode

  // Game Actions
  UpdateRoomCode(String)
  UpdatePlayerName(String)
  SetPlayerName
  UpdateAddWordInput(String)
  AddWord
  AddRandomWord
  RemoveWord(String)
  StartRound
  AddNextPreferedWord(String)
  ClearOrderedWords
  SubmitOrderedWords
}

const dev_mode = False

fn server(uri: uri.Uri, path) -> String {
  let host = option.unwrap(uri.host, "localhost")
  case dev_mode {
    True -> "http://localhost:8080" <> path
    False ->
      "https://"
      <> host
      <> option.map(uri.port, fn(port) { ":" <> int.to_string(port) })
      |> option.unwrap("")
      <> path
  }
}

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}

fn relative(path: String) -> uri.Uri {
  uri.Uri(..uri.empty, path: path)
}

fn init(_flags) -> #(Model, effect.Effect(Msg)) {
  let uri = modem.initial_uri()
  case uri, uri |> result.map(get_route_from_uri) {
    Ok(uri), Ok(Play(Some(room_code))) -> {
      let rejoin =
        storage.session()
        |> result.try(fn(session_storage) {
          use id <- result.try(storage.get_item(
            session_storage,
            "connection_id",
          ))
          use name <- result.try(storage.get_item(
            session_storage,
            "player_name",
          ))
          use stored_room_code <- result.try(storage.get_item(
            session_storage,
            "room_code",
          ))
          case room_code == stored_room_code {
            True ->
              Ok(#(
                id,
                name,
                ws.init(
                  server(uri, "/ws/" <> id <> "/" <> name),
                  WebSocketEvent,
                ),
              ))
            False -> {
              storage.clear(session_storage)
              Error(Nil)
            }
          }
        })
      case rejoin {
        Ok(#(id, name, msg)) -> #(
          InRoom(
            uri,
            PlayerId(id),
            RoomCode(room_code),
            PlayerName(name),
            None,
            DisplayState(Round, False),
            None,
          ),
          msg,
        )
        Error(_) -> #(
          NotInRoom(
            uri,
            Play(Some(room_code)),
            room_code,
            Some("Sorry, please try joining again."),
          ),
          effect.batch([
            join_game(uri, RoomCode(room_code)),
            modem.init(on_url_change),
          ]),
        )
      }
    }
    Ok(uri), Ok(route) -> #(
      NotInRoom(uri, route, "", None),
      modem.init(on_url_change),
    )
    Error(Nil), _ | _, Error(Nil) -> #(
      NotInRoom(relative(""), Home, "", None),
      modem.init(on_url_change),
    )
  }
}

pub fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case model, msg {
    NotInRoom(uri:, ..), StartGame -> #(model, start_game(uri))
    NotInRoom(
      uri:,
      ..,
    ),
      JoinedRoom(Ok(shared.RoomResponse(room_code, player_id)))
    -> {
      #(
        InRoom(
          uri:,
          player_id:,
          room_code:,
          player_name: PlayerName(""),
          active_game: None,
          display_state: DisplayState(Round, False),
          error: None,
        ),
        modem.push(
          "/play",
          Some(
            uri.query_to_string([
              #("game", shared.room_code_to_string(room_code)),
            ]),
          ),
          None,
        ),
      )
    }
    NotInRoom(
      uri:,
      room_code_input:,
      ..,
    ),
      JoinedRoom(Error(lustre_http.NotFound))
    -> {
      #(
        NotInRoom(
          uri,
          Play(None),
          room_code_input,
          Some("No game found with that room code."),
        ),
        effect.none(),
      )
    }
    NotInRoom(room_code_input:, ..), OnRouteChange(uri, Play(Some(room_code))) -> #(
      NotInRoom(uri, Play(Some(room_code)), room_code_input, None),
      join_game(uri, RoomCode(room_code)),
    )
    NotInRoom(room_code_input:, ..), OnRouteChange(uri, route) -> #(
      NotInRoom(uri, route, room_code_input, None),
      effect.none(),
    )
    NotInRoom(uri:, route:, ..), UpdateRoomCode(room_code) -> #(
      NotInRoom(uri, route, string.uppercase(room_code), None),
      effect.none(),
    )
    NotInRoom(uri:, room_code_input:, ..), JoinGame -> #(
      model,
      join_game(uri, RoomCode(room_code_input)),
    )
    NotInRoom(..), UpdatePlayerName(_) -> #(model, effect.none())
    NotInRoom(..), _ -> #(model, effect.none())
    InRoom(room_code:, ..), CopyRoomCode -> {
      let _ = clipboard.write_text(shared.room_code_to_string(room_code))
      #(model, effect.none())
    }
    InRoom(..), ShowMenu(val) -> {
      #(
        InRoom(
          ..model,
          display_state: DisplayState(..model.display_state, menu_open: val),
        ),
        effect.none(),
      )
    }
    InRoom(..), SetView(view) -> {
      #(
        InRoom(..model, display_state: DisplayState(view, False)),
        effect.none(),
      )
    }
    InRoom(
      uri:,
      room_code: RoomCode(room_code),
      ..,
    ),
      OnRouteChange(
        route: Play(Some(new_room_code)),
        ..,
      )
      if room_code != new_room_code
    -> #(
      NotInRoom(uri, Play(Some(new_room_code)), new_room_code, None),
      join_game(uri, RoomCode(room_code)),
    )
    InRoom(..), OnRouteChange(route: Play(Some(..)), ..) -> #(
      model,
      effect.none(),
    )
    InRoom(..), OnRouteChange(uri, route) -> #(
      NotInRoom(uri, route, "", None),
      effect.none(),
    )
    InRoom(..), UpdatePlayerName(player_name) -> #(
      InRoom(..model, player_name: PlayerName(player_name)),
      effect.none(),
    )
    InRoom(uri:, player_id:, player_name:, active_game: None, ..), SetPlayerName
    -> {
      #(
        model,
        lustre_http.post(
          server(uri, "/validatename"),
          shared.encode_http_request(shared.ValidateNameRequest(
            player_id,
            player_name,
          )),
          lustre_http.expect_json(shared.http_response_decoder(), NameIsValid),
        ),
      )
    }
    InRoom(
      uri:,
      player_id: PlayerId(player_id),
      room_code: RoomCode(room_code),
      player_name: PlayerName(player_name),
      active_game: None,
      ..,
    ),
      NameIsValid(response)
    -> {
      case response {
        Ok(shared.ValidateNameResponse(True)) -> {
          let _ =
            storage.session()
            |> result.try(fn(session_storage) {
              result.all([
                storage.set_item(session_storage, "connection_id", player_id),
                storage.set_item(session_storage, "player_name", player_name),
                storage.set_item(session_storage, "room_code", room_code),
              ])
            })
          #(
            model,
            ws.init(
              server(uri, "/ws/" <> player_id <> "/" <> player_name),
              WebSocketEvent,
            ),
          )
        }
        Ok(..) -> {
          echo "received incorrect response from validate name"
          #(
            InRoom(..model, error: Some("An error occurred, please try again")),
            effect.none(),
          )
        }
        Error(lustre_http.OtherError(412, reason)) -> {
          #(InRoom(..model, error: Some(reason)), effect.none())
        }
        Error(error) -> {
          echo "failed to validate name"
          echo error
          #(model, effect.none())
        }
      }
    }
    InRoom(..), WebSocketEvent(ws_event) -> {
      case ws_event {
        ws.InvalidUrl -> panic
        ws.OnOpen(socket) -> #(
          InRoom(
            ..model,
            active_game: Some(ActiveGame(
              ws: socket,
              room: None,
              round: None,
              add_word_input: "",
            )),
          ),
          effect.none(),
        )
        ws.OnTextMessage(msg) -> handle_ws_message(model, msg)
        ws.OnBinaryMessage(msg) ->
          case bit_array.to_string(msg) {
            Ok(msg) -> handle_ws_message(model, msg)
            Error(_) -> #(model, effect.none())
          }
        ws.OnClose(_reason) -> #(
          InRoom(
            ..model,
            active_game: None,
            display_state: DisplayState(Round, False),
            error: Some("Lost connection"),
          ),
          effect.none(),
        )
      }
    }
    InRoom(
      active_game: Some(ActiveGame(ws, room, round, add_word_input)),
      ..,
    ),
      AddWord
      if add_word_input != ""
    -> {
      #(
        InRoom(..model, active_game: Some(ActiveGame(ws, room, round, ""))),
        ws.send(
          ws,
          shared.encode(
            shared.AddWord(add_word_input),
            shared.encode_websocket_request,
          ),
        ),
      )
    }
    InRoom(active_game: Some(active_game), ..), AddRandomWord -> {
      #(
        model,
        ws.send(
          active_game.ws,
          shared.encode(shared.AddRandomWord, shared.encode_websocket_request),
        ),
      )
    }
    InRoom(active_game: Some(active_game), ..), RemoveWord(word) -> {
      #(
        model,
        ws.send(
          active_game.ws,
          shared.encode(
            shared.RemoveWord(word),
            shared.encode_websocket_request,
          ),
        ),
      )
    }
    InRoom(active_game: Some(active_game), ..), UpdateAddWordInput(value) -> {
      #(
        InRoom(
          ..model,
          active_game: Some(ActiveGame(..active_game, add_word_input: value)),
        ),
        effect.none(),
      )
    }
    InRoom(active_game: Some(active_game), ..), StartRound -> {
      #(
        model,
        ws.send(
          active_game.ws,
          shared.encode(shared.StartRound, shared.encode_websocket_request),
        ),
      )
    }
    InRoom(
      active_game: Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
      ..,
    ),
      AddNextPreferedWord(word)
    -> {
      #(
        InRoom(
          ..model,
          active_game: Some(ActiveGame(
            ws,
            room,
            add_word_input,
            round: Some(
              RoundState(..round_state, ordered_words: [
                word,
                ..round_state.ordered_words
                |> list.filter(fn(existing_word) { existing_word != word })
              ]),
            ),
          )),
        ),
        effect.none(),
      )
    }
    InRoom(
      active_game: Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
      ..,
    ),
      ClearOrderedWords
    -> {
      #(
        InRoom(
          ..model,
          active_game: Some(ActiveGame(
            ws,
            room,
            Some(RoundState(..round_state, ordered_words: [])),
            add_word_input,
          )),
        ),
        effect.none(),
      )
    }
    InRoom(
      active_game: Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
      ..,
    ),
      SubmitOrderedWords
    -> {
      #(
        InRoom(
          ..model,
          active_game: Some(ActiveGame(
            ws,
            room,
            Some(RoundState(..round_state, submitted: True)),
            add_word_input,
          )),
        ),
        ws.send(
          ws,
          shared.encode(
            shared.SubmitOrderedWords(round_state.ordered_words),
            shared.encode_websocket_request,
          ),
        ),
      )
    }
    InRoom(player_id:, active_game: Some(ActiveGame(ws:, ..)), ..), LeaveGame -> {
      #(
        model,
        ws.send(
          ws,
          shared.encode(
            shared.RemovePlayer(player_id),
            shared.encode_websocket_request,
          ),
        ),
      )
    }
    InRoom(..), _ -> #(model, effect.none())
  }
}

fn handle_ws_message(model: Model, msg: String) -> #(Model, effect.Effect(Msg)) {
  case model {
    NotInRoom(..) | InRoom(active_game: None, ..) -> #(model, effect.none())
    InRoom(uri:, active_game: Some(active_game), ..) ->
      case shared.decode(msg, shared.websocket_response_decoder()) {
        Ok(shared.InitialRoomState(room)) -> #(
          InRoom(
            ..model,
            active_game: Some(
              ActiveGame(
                ..active_game,
                room: Some(room),
                round: option.or(
                  room.round
                    |> option.map(fn(round) {
                      RoundState(
                        round: round,
                        ordered_words: [],
                        submitted: False,
                      )
                    }),
                  active_game.round,
                ),
              ),
            ),
          ),
          effect.none(),
        )
        Ok(shared.PlayersInRoom(player_list)) -> {
          let room =
            option.map(active_game.room, fn(room) {
              shared.Room(..room, players: player_list)
            })
          #(
            InRoom(..model, active_game: Some(ActiveGame(..active_game, room:))),
            effect.none(),
          )
        }
        Ok(shared.WordList(word_list)) -> {
          let room =
            option.map(active_game.room, fn(room) {
              shared.Room(..room, word_list: word_list)
            })
          #(
            InRoom(
              ..model,
              active_game: Some(ActiveGame(..active_game, room: room)),
            ),
            effect.none(),
          )
        }
        Ok(shared.RoundInfo(round)) -> #(
          InRoom(
            ..model,
            active_game: Some(
              ActiveGame(
                ..active_game,
                round: option.then(active_game.round, fn(active_game_round) {
                    Some(RoundState(..active_game_round, round: round))
                  })
                  |> option.or(Some(RoundState(round, [], False))),
              ),
            ),
          ),
          effect.none(),
        )
        Ok(shared.RoundResult(finished_round)) -> {
          #(
            InRoom(
              ..model,
              active_game: Some(
                ActiveGame(
                  ..active_game,
                  round: None,
                  room: active_game.room
                    |> option.map(fn(room) {
                      shared.Room(..room, finished_rounds: [
                        finished_round,
                        ..room.finished_rounds
                      ])
                    }),
                ),
              ),
              display_state: DisplayState(Scores, False),
            ),
            effect.none(),
          )
        }
        Ok(shared.Kicked) -> {
          #(NotInRoom(uri, Home, "", None), modem.push("/", None, None))
        }
        Ok(shared.ServerError(reason)) -> {
          echo reason
          #(model, effect.none())
        }
        Error(err) -> {
          echo err
          #(model, effect.none())
        }
      }
  }
}

fn start_game(uri: uri.Uri) {
  lustre_http.get(
    server(uri, "/createroom"),
    lustre_http.expect_json(shared.http_response_decoder(), JoinedRoom),
  )
}

fn join_game(uri: uri.Uri, room_code: RoomCode) {
  echo "joining room"
  lustre_http.post(
    server(uri, "/joinroom"),
    shared.encode_http_request(shared.JoinRoomRequest(room_code)),
    lustre_http.expect_json(shared.http_response_decoder(), JoinedRoom),
  )
}

fn get_route_from_uri(uri: uri.Uri) -> Route {
  let room_code =
    uri.query
    |> option.map(uri.parse_query)
    |> option.then(fn(query) {
      case query {
        Ok([#("game", room_code)]) -> Some(room_code)
        _ -> None
      }
    })
  case uri.path_segments(uri.path), room_code {
    [""], _ | [], _ -> Home
    ["play"], room_code -> Play(room_code)
    _, _ -> NotFound
  }
}

fn on_url_change(uri: uri.Uri) -> Msg {
  get_route_from_uri(uri) |> OnRouteChange(uri, _)
}

pub fn view(model: Model) -> element.Element(Msg) {
  html.div([], [
    html.div([class("flex flex-col h-dvh max-h-dvh")], [
      header(model),
      html.div([class("max-h-full overflow-y-auto")], [content(model)]),
      footer(model),
    ]),
  ])
}

fn link(href, content, class_name) {
  html.a(
    [
      class("p-2 underline border-solid rounded m-2 " <> class_name),
      attribute.href(href),
    ],
    content,
  )
}

fn header(model: Model) {
  case model {
    NotInRoom(route: Home, ..) ->
      html.h1([class("text-4xl my-10 text-center")], [
        element.text("A Full Fridge"),
      ])
    NotInRoom(route: Play(Some(_)), ..) ->
      html.div([], [
        html.nav([class("flex items-center bg-sky-100 text-blue-900")], [
          link(
            "/",
            [icon.house([class("mr-2 inline")]), element.text("Home")],
            "",
          ),
        ]),
        html.h1([class("text-2xl my-5")], [element.text("Joining game...")]),
      ])
    NotInRoom(route: Play(None), ..) ->
      html.div([], [
        html.nav([class("flex items-center bg-sky-100 text-blue-900")], [
          link(
            "/",
            [icon.house([class("mr-2 inline")]), element.text("Home")],
            "",
          ),
        ]),
        html.h1([class("text-2xl my-5 mx-4")], [element.text("Join game")]),
      ])
    InRoom(room_code:, display_state: DisplayState(menu_open: False, ..), ..) ->
      html.div([class("flex bg-green-700 text-gray-100")], [
        html.h1([class("text-xl my-5 mx-2")], [
          element.text("Game:"),
          html.code(
            [
              event.on_click(CopyRoomCode),
              attribute.attribute("title", "Copy"),
              class(
                "mx-1 px-1 text-gray-100 border-dashed border-2 rounded-sm border-transparent hover:border-slate-500 hover:bg-green-200 hover:text-gray-800 cursor-pointer",
              ),
            ],
            [element.text(shared.room_code_to_string(room_code))],
          ),
        ]),
        html.button(
          [event.on_click(ShowMenu(True)), class("ml-auto px-3 py-2")],
          [element.text("Menu"), icon.menu([class("ml-2 inline")])],
        ),
      ])
    InRoom(room_code:, display_state: DisplayState(menu_open: True, ..), ..) ->
      html.div([class("flex bg-green-700 text-gray-100")], [
        html.h1([class("text-xl my-5 mx-2")], [
          element.text("Game:"),
          html.code(
            [
              event.on_click(CopyRoomCode),
              attribute.attribute("title", "Copy"),
              class(
                "mx-1 px-1 text-gray-100 border-dashed border-2 rounded-sm border-transparent hover:border-slate-500 hover:bg-green-200 hover:text-gray-800 cursor-pointer",
              ),
            ],
            [element.text(shared.room_code_to_string(room_code))],
          ),
        ]),
        html.button(
          [event.on_click(ShowMenu(False)), class("ml-auto px-3 py-2")],
          [element.text("Close"), icon.x([class("ml-2 inline")])],
        ),
      ])
    NotInRoom(route: NotFound, ..) ->
      html.div([], [
        html.nav([class("flex items-center")], [
          link("/", [element.text("Home")], ""),
        ]),
        html.h1([class("text-2xl my-5")], [element.text("Page not found")]),
      ])
  }
}

fn content(model: Model) {
  case model {
    NotInRoom(route: Home, join_room_err:, ..) ->
      html.div([class("text-center")], [
        case join_room_err {
          Some(err) -> html.div([class("bg-red-50")], [element.text(err)])
          None -> element.none()
        },
        html.p([class("mx-4 text-lg mb-8")], [
          element.text("A game about preferences best played with friends."),
        ]),
        html.div([class("flex flex-col items-center")], [
          html.button(
            [
              event.on_click(StartGame),
              class(
                "w-36 p-2 bg-green-700 text-white rounded hover:bg-green-600",
              ),
            ],
            [element.text("Start new game")],
          ),
          link(
            "/play",
            [element.text("Join a game")],
            "w-36 text-white bg-sky-600 rounded hover:bg-sky-500 no-underline",
          ),
        ]),
      ])
    NotInRoom(route: Play(Some(room_code)), join_room_err: None, ..) ->
      element.text("Joining room " <> room_code <> "...")
    NotInRoom(route: Play(None), room_code_input:, join_room_err:, ..) ->
      html.form(
        [event.on_submit(JoinGame), class("flex flex-wrap items-center mx-4")],
        [
          html.label(
            [attribute.for("room-code-input"), class("flex-initial mr-2 mb-2")],
            [element.text("Enter game code:")],
          ),
          html.div([class("mb-2")], [
            html.input([
              attribute.id("room-code-input"),
              attribute.placeholder("ABCD"),
              attribute.type_("text"),
              class(
                "mr-2 p-2 w-16 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono placeholder:opacity-50 tracking-widest",
              ),
              event.on_input(UpdateRoomCode),
              attribute.value(room_code_input),
            ]),
            html.button(
              [
                attribute.type_("submit"),
                attribute.disabled(
                  string.length(string.trim(room_code_input)) != 4,
                ),
                class(
                  "rounded px-3 py-2 border bg-sky-600 hover:bg-sky-500 text-white hover:shadow-md disabled:opacity-50 disabled:bg-sky-600 disabled:shadow-none",
                ),
              ],
              [element.text("Join")],
            ),
          ]),
          case join_room_err {
            Some(err) ->
              html.div([class("ml-2 text-red-800")], [element.text(err)])
            None -> element.none()
          },
        ],
      )
    InRoom(
      player_id:,
      active_game: Some(ActiveGame(
        room: Some(room),
        round: Some(round_state),
        ..,
      )),
      display_state: DisplayState(Round, False),
      ..,
    ) ->
      html.div([class("flex flex-col max-w-2xl mx-auto")], [
        html.div([class("m-4")], [
          html.h2([class("text-lg mb-2")], [
            element.text(choosing_player_heading(
              room.players,
              player_id,
              round_state.round.leading_player_id,
            )),
          ]),
          html.div(
            [class("flex flex-col flex-wrap")],
            list.map(round_state.round.words, fn(word) {
              let bg_colour = case
                list.find(round_state.ordered_words, fn(w) { w == word })
              {
                Ok(_) -> "bg-green-50"
                Error(_) -> ""
              }
              html.button(
                [
                  event.on_click(AddNextPreferedWord(word)),
                  class(
                    "p-2 m-1 rounded border border-slate-200 hover:shadow-md "
                    <> bg_colour,
                  ),
                ],
                [element.text(word)],
              )
            }),
          ),
          html.ol(
            [class("list-decimal list-inside p-3")],
            list.reverse(round_state.ordered_words)
              |> list.map(fn(word) { html.li([], [element.text(word)]) }),
          ),
          html.div([class("mb-4 flex items-center justify-between")], [
            html.button(
              [
                event.on_click(ClearOrderedWords),
                attribute.disabled(
                  round_state.ordered_words == [] || round_state.submitted,
                ),
                class(
                  "py-2 px-3 rounded m-2 bg-red-100 text-red-800 hover:shadow-md hover:bg-red-200 disabled:bg-red-100 disabled:opacity-50 disabled:shadow-none",
                ),
              ],
              [element.text("Clear"), icon.x([class("ml-2 inline")])],
            ),
            html.button(
              [
                event.on_click(SubmitOrderedWords),
                attribute.disabled(
                  list.length(round_state.ordered_words)
                  != list.length(round_state.round.words)
                  || round_state.submitted,
                ),
                class(
                  "py-2 px-3 m-2 rounded bg-green-100 text-green-900 hover:shadow-md hover:bg-green-200 disabled:green-50 disabled:opacity-50 disabled:shadow-none",
                ),
              ],
              [element.text("Submit"), icon.check([class("ml-2 inline")])],
            ),
          ]),
          case round_state.submitted {
            True ->
              html.div([], [
                html.h6([], [element.text("Waiting for other players:")]),
                html.ul(
                  [class("list-disc list-inside p-2")],
                  list.filter_map(room.players, fn(player) {
                    case list.contains(round_state.round.submitted, player.id) {
                      False ->
                        Ok(
                          html.li([], [
                            player.name
                            |> shared.player_name_to_string
                            |> element.text,
                          ]),
                        )
                      True -> Error(Nil)
                    }
                  }),
                ),
              ])
            False -> element.none()
          },
        ]),
      ])
    InRoom(
      player_id:,
      active_game: Some(ActiveGame(
        room: Some(room),
        round: Some(round_state),
        ..,
      )),
      display_state: DisplayState(Scores, False),
      ..,
    ) ->
      html.div([class("max-w-2xl mx-auto")], [
        html.div([class("flex flex-col m-4")], [
          display_players(
            room.players,
            round_state.round.leading_player_id,
            room.finished_rounds,
          ),
          html.hr([class("my-4 text-gray-400")]),
          html.h2([class("text-2xl mt-1 mb-3 font-bold")], [
            element.text("Previous rounds"),
            html.span([class("font-normal")], [element.text(" (latest first)")]),
          ]),
          ..list.reverse(room.finished_rounds)
          |> list.index_map(display_finished_round(player_id))
          |> list.reverse
        ]),
      ])
    InRoom(
      active_game: Some(ActiveGame(
        room: Some(room),
        round: Some(..),
        add_word_input:,
        ..,
      )),
      display_state: DisplayState(WordList, False),
      ..,
    ) ->
      html.div(
        [class("flex flex-col p-4 max-w-2xl mx-auto")],
        display_full_word_list(room, add_word_input),
      )
    InRoom(
      active_game: Some(ActiveGame(room: Some(..), round:, ..)),
      display_state: DisplayState(view, True),
      ..,
    ) -> display_menu(view, option.is_some(round))
    InRoom(
      player_id:,
      active_game: Some(ActiveGame(
        room: Some(room),
        round: None,
        add_word_input:,
        ..,
      )),
      ..,
    ) ->
      html.div([class("flex flex-col p-4 max-w-2xl mx-auto")], [
        html.div([], [
          html.h2([class("text-lg")], [element.text("Players:")]),
          html.ul(
            [class("ml-3")],
            list.reverse(room.players)
              |> list.map(fn(player) {
                let connected = case player.connected {
                  True -> ""
                  False -> " - (disconnected)"
                }
                let display =
                  case player.name, player.id {
                    PlayerName(""), id if id == player_id ->
                      shared.player_id_to_string(id) <> " (you)"
                    PlayerName(name), id if id == player_id -> name <> " (you)"
                    PlayerName(""), id -> shared.player_id_to_string(id)
                    PlayerName(name), _ -> name
                  }
                  |> fn(name) { name <> connected }
                  |> element.text
                html.li([], [display])
              }),
          ),
        ]),
        html.hr([class("my-2 text-gray-300")]),
        html.p([], [
          element.text("Please add some things to the list. "),
          element.text(
            "Each round, 5 things will be picked at random from this list.",
          ),
        ]),
        ..display_full_word_list(room, add_word_input)
      ])
    InRoom(player_name:, active_game: None, error:, ..) ->
      html.div([class("flex flex-col m-4 max-w-2xl mx-auto")], [
        html.form([event.on_submit(SetPlayerName), class("flex flex-col m-4")], [
          html.label([attribute.for("name-input")], [element.text("Name:")]),
          html.input([
            attribute.id("name-input"),
            attribute.placeholder("Enter name..."),
            event.on_input(UpdatePlayerName),
            attribute.value(shared.player_name_to_string(player_name)),
            attribute.type_("text"),
            class(
              "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:opacity-50",
            ),
          ]),
          html.button(
            [
              attribute.type_("submit"),
              attribute.disabled(
                string.trim(shared.player_name_to_string(player_name)) == "",
              ),
              class(
                "p-2 text-lime-900 bg-emerald-100 hover:bg-emerald-200 rounded disabled:bg-emerald-100 disabled:text-lime-700 disabled:opacity-50",
              ),
            ],
            [element.text("Join room")],
          ),
          case error {
            Some(error) ->
              html.div([class("ml-2 text-red-800")], [element.text(error)])
            None -> element.none()
          },
        ]),
      ])
    InRoom(
      room_code:,
      player_name:,
      active_game: Some(ActiveGame(room: None, ..)),
      error:,
      ..,
    ) -> {
      html.div([class("flex flex-col m-4")], [
        html.div([], [
          html.h2([], [element.text(shared.player_name_to_string(player_name))]),
          case error {
            Some(error) -> element.text(error)
            None ->
              element.text(
                "Connecting to room "
                <> shared.room_code_to_string(room_code)
                <> "...",
              )
          },
        ]),
      ])
    }
    NotInRoom(route: NotFound, ..) | _ -> element.text("Page not found")
  }
}

fn footer(model: Model) {
  case model {
    InRoom(active_game: Some(ActiveGame(room: Some(..), round: None, ..)), ..) ->
      html.button(
        [
          event.on_click(StartRound),
          class(
            "mt-auto py-3 border-t-2 border-green-400 bg-green-50 text-green-900 hover:bg-green-100",
          ),
        ],
        [element.text("Start game 🚀")],
      )
    InRoom(
      active_game: Some(ActiveGame(room: Some(..), round: Some(..), ..)),
      display_state: DisplayState(
        view: Scores,
        ..,
      ),
      ..,
    ) ->
      html.button(
        [
          event.on_click(SetView(Round)),
          class(
            "mt-auto py-3 border-t-2 border-green-400 bg-green-50 text-green-900 hover:bg-green-100",
          ),
        ],
        [element.text("Back to game")],
      )
    _ -> html.div([], [])
  }
}

fn choosing_player_heading(
  players: List(shared.Player),
  self_player_id: shared.PlayerId,
  leading_player_id: shared.PlayerId,
) {
  list.find(players, fn(player) { player.id == leading_player_id })
  |> result.map(fn(player) {
    case player.id == self_player_id {
      False ->
        "You are guessing "
        <> shared.player_name_to_string(player.name)
        <> "'s order of preference"
      True -> "It's your turn! Select the things below in your preference order"
    }
  })
  |> result.unwrap("Select the options below in order")
}

fn display_players(
  players: List(shared.Player),
  leading_player_id: shared.PlayerId,
  finished_rounds: List(shared.FinishedRound),
) {
  let scores =
    list.fold(finished_rounds, [], fn(scores, round) {
      let round_scores =
        round.player_scores |> list.map(fn(score) { #(score.player.id, score) })
      list.fold(
        round_scores,
        scores,
        fn(scores: List(#(shared.PlayerId, shared.PlayerScore)), round_score) {
          case list.find(scores, fn(s) { s.0 == round_score.0 }) {
            Ok(score) -> {
              let rest = scores |> list.filter(fn(s) { s.0 != score.0 })
              [
                #(
                  score.0,
                  shared.PlayerScore(
                    { score.1 }.player,
                    [],
                    { score.1 }.score + { round_score.1 }.score,
                  ),
                ),
                ..rest
              ]
            }
            Error(Nil) -> [round_score, ..scores]
          }
        },
      )
    })

  html.div(
    [class("flex flex-col")],
    list.reverse(players)
      |> list.map(fn(player) {
        let score =
          list.find(scores, fn(score) { score.0 == player.id })
          |> result.map(fn(s) { { s.1 }.score })
          |> result.unwrap(0)
          |> int.to_string

        let extra_class = case player.id == leading_player_id {
          True -> " border border-gray-200 shadow"
          False -> ""
        }
        html.div(
          [class("my-1 p-2 rounded flex justify-between" <> extra_class)],
          [
            html.span([], [
              element.text(shared.player_name_to_string(player.name)),
              case player.connected {
                True -> element.none()
                False -> element.text(" - disconnected")
              },
            ]),
            html.strong([], [element.text(score)]),
          ],
        )
      }),
  )
}

fn display_finished_round(player_id: PlayerId) {
  fn(finished_round: shared.FinishedRound, round_index: Int) {
    let player_text = fn(player: shared.Player, score: Int) {
      case player.id == finished_round.leading_player_id {
        True -> shared.player_name_to_string(player.name) <> "'s ranking"
        False ->
          shared.player_name_to_string(player.name)
          <> "'s guess - "
          <> int.to_string(score)
          <> " points"
      }
    }

    html.div([class("my-3 py-1 border-solid border-l-2 p-2 border-gray-300")], [
      html.h3([class("text-xl mb-2 font-bold")], [
        element.text("Round " <> int.to_string(round_index + 1)),
      ]),
      html.div(
        [],
        list.sort(finished_round.player_scores, fn(a, b) {
          case
            a.player.id == finished_round.leading_player_id,
            b.player.id == finished_round.leading_player_id,
            a.player.id == player_id,
            b.player.id == player_id
          {
            True, _, _, _ -> order.Lt
            _, True, _, _ -> order.Gt
            _, _, True, _ -> order.Lt
            _, _, _, True -> order.Gt
            False, False, False, False -> int.compare(b.score, a.score)
          }
        })
          |> list.map(fn(player_score) {
            html.div([], [
              html.h4([class("text-lg")], [
                element.text(player_text(
                  player_score.player,
                  player_score.score,
                )),
              ]),
              html.ol(
                [class("list-decimal list-inside p-2")],
                list.reverse(player_score.words)
                  |> list.map(fn(word) { html.li([], [element.text(word)]) }),
              ),
            ])
          }),
      ),
    ])
  }
}

fn display_menu(current_view: InGameView, game_started: Bool) {
  html.div([class("my-4 mx-2 max-w-90 flex flex-col items-center")], [
    html.button(
      [
        event.on_click(SetView(Round)),
        attribute.disabled(current_view == Round || !game_started),
        class("underline p-2 disabled:no-underline disabled:text-slate-600"),
      ],
      [element.text("Current round")],
    ),
    html.button(
      [
        event.on_click(SetView(Scores)),
        attribute.disabled(current_view == Scores || !game_started),
        class("underline p-2 disabled:no-underline disabled:text-slate-600"),
      ],
      [element.text("View scores")],
    ),
    html.button(
      [
        event.on_click(SetView(WordList)),
        attribute.disabled(current_view == WordList || !game_started),
        class("underline p-2 disabled:no-underline disabled:text-slate-600"),
      ],
      [element.text("Update list")],
    ),
    html.hr([class("mt-4 mb-2 mx-2 w-4/5")]),
    html.button(
      [
        event.on_click(LeaveGame),
        class(
          "underline p-2 disabled:no-underline disabled:text-slate-600 flex items-center p-2",
        ),
      ],
      [icon.log_out([class("mr-2 inline")]), element.text("Leave game")],
    ),
  ])
}

fn display_full_word_list(room: shared.Room, add_word_input: String) {
  [
    html.form(
      [event.on_submit(AddWord), class("my-2 flex items-center flex-wrap")],
      [
        html.label([attribute.for("add-word-input"), class("mr-2")], [
          element.text("Add to list"),
        ]),
        html.div([class("flex max-w-80 min-w-56 flex-auto")], [
          html.input([
            attribute.id("add-word-input"),
            attribute.type_("text"),
            attribute.placeholder("A full fridge"),
            class(
              "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:opacity-50 flex-auto w-24",
            ),
            event.on_input(UpdateAddWordInput),
            attribute.value(add_word_input),
          ]),
          html.button(
            [
              attribute.type_("submit"),
              class(
                "py-2 px-3 ml-2 bg-green-200 hover:bg-green-300 rounded flex-none self-center",
              ),
            ],
            [element.text("Add"), icon.plus([class("ml-2 inline")])],
          ),
        ]),
      ],
    ),
    html.button(
      [
        event.on_click(AddRandomWord),
        class(
          "p-2 rounded border-solid border border-gray-200 hover:bg-emerald-50",
        ),
      ],
      [element.text("Add random 🎲")],
    ),
    html.div([], [
      html.h2([class("text-lg my-2")], [element.text("List of words:")]),
      html.ul(
        [],
        list.map(room.word_list, fn(word) {
          html.li(
            [
              class(
                "flex justify-between items-center hover:bg-slate-100 pl-3 my-1",
              ),
            ],
            [
              element.text(word),
              html.button(
                [
                  event.on_click(RemoveWord(word)),
                  class(
                    "rounded text-red-800 bg-red-50 border border-solid border-red-100 py-1 px-2 hover:bg-red-100",
                  ),
                ],
                [icon.x([class("inline")])],
              ),
            ],
          )
        }),
      ),
    ]),
  ]
}
