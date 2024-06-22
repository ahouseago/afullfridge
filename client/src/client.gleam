import gleam/int
import gleam/io
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/order
import gleam/result
import gleam/string
import gleam/uri
import lustre
import lustre/attribute
import lustre/effect
import lustre/element
import lustre/element/html
import lustre/event
import lustre/ui
import lustre/ui/button
import lustre/ui/icon
import lustre/ui/input
import lustre/ui/util/styles
import lustre_http
import lustre_websocket as ws
import modem
import plinth/javascript/storage
import shared

pub type Model {
  NotInRoom(uri: uri.Uri, route: Route, room_code_input: String)
  InRoom(
    player_id: shared.PlayerId,
    room_code: shared.RoomCode,
    player_name: String,
    active_game: Option(ActiveGame),
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

pub type RoundState {
  RoundState(round: shared.Round, ordered_words: List(String), submitted: Bool)
}

pub type Route {
  Home
  Play(room_code: Option(String))
  NotFound
}

pub type Msg {
  OnRouteChange(uri.Uri, Route)

  WebSocketEvent(ws.WebSocketEvent)
  OnWebsocketMessage(shared.WebsocketResponse)

  StartGame
  JoinGame
  JoinedRoom(Result(shared.HttpResponse, lustre_http.HttpError))

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

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}

fn new_uri() -> uri.Uri {
  uri.Uri(
    scheme: None,
    userinfo: None,
    host: None,
    port: None,
    path: "",
    query: None,
    fragment: None,
  )
}

fn relative(path: String) -> uri.Uri {
  uri.Uri(..new_uri(), path: path)
}

fn init(_flags) -> #(Model, effect.Effect(Msg)) {
  let uri = modem.initial_uri()
  case uri, uri |> result.map(get_route_from_uri) {
    Ok(uri), Ok(Play(Some(room_code))) -> {
      let rejoin =
        storage.local()
        |> result.try(fn(local_storage) {
          use id <- result.try(storage.get_item(local_storage, "connection_id"))
          use name <- result.map(storage.get_item(local_storage, "player_name"))

          #(
            id,
            name,
            ws.init(
              "ws://localhost:3000/ws/" <> id <> "/" <> name,
              WebSocketEvent,
            ),
          )
        })
      case rejoin {
        Ok(#(id, name, msg)) -> #(InRoom(id, room_code, name, None), msg)
        Error(_) -> #(
          NotInRoom(uri, Play(Some(room_code)), room_code),
          effect.batch([join_game(room_code), modem.init(on_url_change)]),
        )
      }
    }
    Ok(uri), Ok(route) -> #(
      NotInRoom(uri, route, ""),
      modem.init(on_url_change),
    )
    Error(Nil), _ | _, Error(Nil) -> #(
      NotInRoom(relative(""), Home, ""),
      modem.init(on_url_change),
    )
  }
}

pub fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case model, msg {
    NotInRoom(_, _, _), StartGame -> #(model, start_game())
    NotInRoom(uri, _, _),
      JoinedRoom(Ok(shared.RoomResponse(room_code, player_id)))
    -> {
      #(
        InRoom(
          player_id: player_id,
          room_code: room_code,
          player_name: "",
          active_game: None,
        ),
        modem.push(
          uri.Uri(
            ..relative("/play"),
            query: Some(uri.query_to_string([#("game", room_code)])),
          ),
        ),
      )
    }
    NotInRoom(_, _, _), JoinedRoom(Error(err)) -> {
      io.debug(err)
      #(model, effect.none())
    }
    NotInRoom(_, _route, room_code_input), OnRouteChange(uri, route) -> #(
      NotInRoom(uri, route, room_code_input),
      effect.none(),
    )
    NotInRoom(uri, route, _room_code_input), UpdateRoomCode(room_code) -> #(
      NotInRoom(uri, route, string.uppercase(room_code)),
      effect.none(),
    )
    NotInRoom(_, _, room_code_input), JoinGame -> #(
      model,
      join_game(room_code_input),
    )
    NotInRoom(_, _, _), UpdatePlayerName(_) -> #(model, effect.none())
    NotInRoom(_, _, _), _ -> #(model, effect.none())
    InRoom(player_id, room_code, _player_name, None),
      UpdatePlayerName(player_name)
    -> #(InRoom(player_id, room_code, player_name, None), effect.none())
    InRoom(player_id, _room_code, player_name, None), SetPlayerName -> {
      let _ =
        storage.local()
        |> result.try(fn(local_storage) {
          result.all([
            storage.set_item(local_storage, "connection_id", player_id),
            storage.set_item(local_storage, "player_name", player_name),
          ])
        })
      #(
        model,
        ws.init(
          "ws://localhost:3000/ws/" <> player_id <> "/" <> player_name,
          WebSocketEvent,
        ),
      )
    }
    InRoom(player_id, room_code, player_name, _), WebSocketEvent(ws_event)
    | InRoom(player_id, room_code, player_name, _), WebSocketEvent(ws_event)
    -> {
      case ws_event {
        ws.InvalidUrl -> panic
        ws.OnOpen(socket) -> #(
          InRoom(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
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
        ws.OnBinaryMessage(_msg) -> #(model, effect.none())
        ws.OnClose(_reason) -> #(
          InRoom(player_id, room_code, player_name, None),
          effect.none(),
        )
      }
    }
    InRoom(
      player_id,
      room_code,
      player_name,
      Some(ActiveGame(ws, room, round, add_word_input)),
    ),
      AddWord
      if add_word_input != ""
    -> {
      #(
        InRoom(
          player_id,
          room_code,
          player_name,
          Some(ActiveGame(ws, room, round, "")),
        ),
        ws.send(ws, shared.encode_request(shared.AddWord(add_word_input))),
      )
    }
    InRoom(_player_id, _room_code, _player_name, Some(active_game)),
      AddRandomWord
    -> {
      #(
        model,
        ws.send(active_game.ws, shared.encode_request(shared.AddRandomWord)),
      )
    }
    InRoom(_player_id, _room_code, _player_name, Some(active_game)),
      RemoveWord(word)
    -> {
      #(
        model,
        ws.send(active_game.ws, shared.encode_request(shared.RemoveWord(word))),
      )
    }
    InRoom(player_id, room_code, player_name, Some(active_game)),
      UpdateAddWordInput(value)
    -> {
      #(
        InRoom(
          player_id,
          room_code,
          player_name,
          Some(ActiveGame(..active_game, add_word_input: value)),
        ),
        effect.none(),
      )
    }
    InRoom(_player_id, _room_code, _player_name, Some(active_game)), StartRound -> {
      #(
        model,
        ws.send(active_game.ws, shared.encode_request(shared.StartRound)),
      )
    }
    InRoom(
      player_id,
      room_code,
      player_name,
      Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
    ),
      AddNextPreferedWord(word)
    -> {
      #(
        InRoom(
          player_id,
          room_code,
          player_name,
          Some(ActiveGame(
            ws,
            room,
            add_word_input,
            round: Some(
              RoundState(
                ..round_state,
                ordered_words: [
                  word,
                  ..round_state.ordered_words
                  |> list.filter(fn(existing_word) { existing_word != word })
                ],
              ),
            ),
          )),
        ),
        effect.none(),
      )
    }
    InRoom(
      player_id,
      room_code,
      player_name,
      Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
    ),
      ClearOrderedWords
    -> {
      #(
        InRoom(
          player_id,
          room_code,
          player_name,
          Some(ActiveGame(
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
      player_id,
      room_code,
      player_name,
      Some(ActiveGame(ws, room, Some(round_state), add_word_input)),
    ),
      SubmitOrderedWords
    -> {
      #(
        InRoom(
          player_id,
          room_code,
          player_name,
          Some(ActiveGame(
            ws,
            room,
            Some(RoundState(..round_state, submitted: True)),
            add_word_input,
          )),
        ),
        ws.send(
          ws,
          shared.encode_request(shared.SubmitOrderedWords(
            round_state.ordered_words,
          )),
        ),
      )
    }
    InRoom(_player_id, _room_code, _player_name, _active_game), _ -> #(
      model,
      effect.none(),
    )
  }
}

fn handle_ws_message(model: Model, msg: String) -> #(Model, effect.Effect(Msg)) {
  case model {
    NotInRoom(_, _, _) | InRoom(_, _, _, None) -> #(model, effect.none())
    InRoom(player_id, room_code, player_name, Some(active_game)) ->
      case shared.decode_websocket_response(msg) {
        Ok(shared.InitialRoomState(room)) -> #(
          InRoom(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
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
            InRoom(
              player_id: player_id,
              room_code: room_code,
              player_name: player_name,
              active_game: Some(ActiveGame(..active_game, room: room)),
            ),
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
              player_id: player_id,
              room_code: room_code,
              player_name: player_name,
              active_game: Some(ActiveGame(..active_game, room: room)),
            ),
            effect.none(),
          )
        }
        Ok(shared.RoundInfo(round)) -> #(
          InRoom(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
            active_game: Some(
              ActiveGame(
                ..active_game,
                round: Some(RoundState(round, [], False)),
              ),
            ),
          ),
          effect.none(),
        )
        Ok(shared.RoundResult(finished_round)) -> {
          #(
            InRoom(
              player_id,
              room_code,
              player_name,
              Some(
                ActiveGame(
                  ..active_game,
                  room: active_game.room
                    |> option.map(fn(room) {
                      shared.Room(
                        ..room,
                        finished_rounds: [
                          finished_round,
                          ..room.finished_rounds
                        ],
                      )
                    }),
                ),
              ),
            ),
            effect.none(),
          )
        }
        Ok(shared.ServerError(reason)) | Error(reason) -> {
          io.debug(reason)
          #(model, effect.none())
        }
      }
  }
}

fn start_game() {
  lustre_http.get(
    "http://localhost:3000/createroom",
    lustre_http.expect_json(shared.decode_http_response_json, JoinedRoom),
  )
}

fn join_game(room_code) {
  lustre_http.post(
    "http://localhost:3000/joinroom",
    shared.encode_http_request(shared.JoinRoomRequest(room_code)),
    lustre_http.expect_json(shared.decode_http_response_json, JoinedRoom),
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
  let content = content(model)

  html.div([], [styles.elements(), header(model), content])
}

fn link(href, content) {
  html.a(
    [
      attribute.class("p-2 underline border-solid rounded m-2"),
      attribute.href(href),
    ],
    content,
  )
}

fn header(model: Model) {
  case model {
    NotInRoom(_, Home, _) ->
      html.h1([attribute.class("text-4xl my-10 text-center")], [
        element.text("A Full Fridge"),
      ])
    NotInRoom(_, Play(Some(_)), _) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [
          element.text("Joining game..."),
        ]),
      ])
    NotInRoom(_, Play(None), _) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [element.text("Join game")]),
      ])
    InRoom(_, room_code, _, _) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          // link("/", [element.text("Leave game")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [
          element.text("Game: " <> room_code),
        ]),
      ])
    NotInRoom(_, NotFound, _) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [
          element.text("Page not found"),
        ]),
      ])
  }
}

fn content(model: Model) {
  case model {
    NotInRoom(_, Home, _) ->
      html.div([], [
        html.p([attribute.class("mx-4 text-lg")], [
          element.text("Welcome to "),
          html.span([], [element.text("A Full Fridge")]),
          element.text(", a game about preferences best played with friends."),
        ]),
        button.button([event.on_click(StartGame)], [
          element.text("Start new game"),
        ]),
        link("/play", [element.text("Join a game")]),
      ])
    NotInRoom(_, Play(Some(room_code)), _) ->
      element.text("Joining room " <> room_code <> "...")
    NotInRoom(_, Play(None), room_code_input) ->
      html.form(
        [event.on_submit(JoinGame), attribute.class("flex flex-col m-4")],
        [
          html.label([attribute.for("room-code-input")], [
            element.text("Enter game code:"),
          ]),
          input.input([
            attribute.id("room-code-input"),
            attribute.placeholder("ABCD"),
            attribute.type_("text"),
            attribute.class(
              "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono",
            ),
            event.on_input(UpdateRoomCode),
            attribute.value(room_code_input),
          ]),
          button.button([attribute.type_("submit")], [element.text("Join")]),
        ],
      )
    InRoom(
      player_id,
      _room_code,
      _player_name,
      Some(ActiveGame(_ws, Some(room), Some(round_state), _add_word_input)),
    ) ->
      html.div([attribute.class("flex flex-col m-4")], [
        html.div([], [
          html.h2([], [
            element.text(get_choosing_player_text(
              room.players,
              player_id,
              round_state.round.leading_player_id,
            )),
          ]),
        ]),
        ui.prose([], [
          html.h2([], [element.text("Words:")]),
          ui.group(
            [],
            list.map(round_state.round.words, fn(word) {
              ui.button([event.on_click(AddNextPreferedWord(word))], [
                element.text(word),
              ])
            }),
          ),
          html.ol(
            [],
            list.reverse(round_state.ordered_words)
              |> list.map(fn(word) { html.li([], [element.text(word)]) }),
          ),
          ui.button(
            [
              event.on_click(ClearOrderedWords),
              attribute.disabled(round_state.ordered_words == []),
              button.error(),
            ],
            [element.text("Clear")],
          ),
          ui.button(
            [
              event.on_click(SubmitOrderedWords),
              attribute.disabled(
                list.length(round_state.ordered_words)
                != list.length(round_state.round.words)
                || round_state.submitted,
              ),
              button.solid(),
            ],
            [element.text("Submit")],
          ),
        ]),
        html.br([]),
        display_scores(room.finished_rounds),
        html.br([]),
        ..list.reverse(room.finished_rounds)
        |> list.index_map(display_finished_round)
        |> list.reverse
      ])
    InRoom(
      player_id,
      _room_code,
      _player_name,
      Some(ActiveGame(_ws, Some(room), None, add_word_input)),
    ) ->
      ui.prose([attribute.class("flex flex-col m-4")], [
        html.div([], [
          button.button([event.on_click(StartRound)], [
            element.text("Start game"),
          ]),
        ]),
        html.div([], [
          html.h2([], [element.text("Players:")]),
          html.ul(
            [],
            list.map(room.players, fn(player) {
              let display =
                case player.name, player.id {
                  "", id if id == player_id -> id <> " (you)"
                  name, id if id == player_id -> name <> " (you)"
                  "", id -> id
                  name, _ -> name
                }
                |> element.text
              html.li([], [display])
            }),
          ),
        ]),
        html.form([event.on_submit(AddWord)], [
          html.label([attribute.for("add-word-input")], [
            element.text("Add to list"),
          ]),
          input.input([
            attribute.id("add-word-input"),
            attribute.type_("text"),
            attribute.class(
              "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono",
            ),
            event.on_input(UpdateAddWordInput),
            attribute.value(add_word_input),
          ]),
          button.button([attribute.type_("submit")], [element.text("Add")]),
        ]),
        button.button([event.on_click(AddRandomWord)], [
          element.text("Add random word 🎲"),
        ]),
        html.div([], [
          html.h2([], [element.text("List of words:")]),
          html.ul(
            [],
            list.map(room.word_list, fn(word) {
              html.li([], [
                element.text(word),
                ui.button([button.error(), event.on_click(RemoveWord(word))], [
                  icon.cross([]),
                ]),
              ])
            }),
          ),
        ]),
      ])
    InRoom(_player_id, _room_code, player_name, None) ->
      html.div([attribute.class("flex flex-col m-4")], [
        html.form(
          [event.on_submit(SetPlayerName), attribute.class("flex flex-col m-4")],
          [
            html.label([attribute.for("name-input")], [element.text("Name:")]),
            input.input([
              attribute.id("name-input"),
              attribute.placeholder("Enter name..."),
              event.on_input(UpdatePlayerName),
              attribute.value(player_name),
              attribute.type_("text"),
              attribute.class(
                "my-2 p-2 border-2 rounded placeholder:text-slate-300",
              ),
            ]),
            button.button([attribute.type_("submit")], [
              element.text("Set name"),
            ]),
          ],
        ),
      ])
    InRoom(
      _player_id,
      room_code,
      player_name,
      Some(ActiveGame(_ws, None, _round, _)),
    ) -> {
      html.div([attribute.class("flex flex-col m-4")], [
        html.div([], [
          html.h2([], [element.text(player_name)]),
          element.text("Connecting to room " <> room_code <> "..."),
        ]),
      ])
    }
    NotInRoom(_, NotFound, _) | _ -> element.text("Page not found")
  }
}

fn get_choosing_player_text(
  players: List(shared.Player),
  player_id: shared.PlayerId,
  leading_player_id: shared.PlayerId,
) {
  case leading_player_id == player_id {
    True -> "You are choosing."
    False ->
      list.find(players, fn(player) { player.id == leading_player_id })
      |> result.map(fn(player) { player.name })
      |> result.unwrap("Someone else")
      <> " is choosing."
  }
}

fn display_scores(finished_rounds: List(shared.FinishedRound)) {
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
    |> list.sort(fn(a, b) { int.compare({ b.1 }.score, { a.1 }.score) })

  ui.prose([], [
    html.h2([], [element.text("Scores")]),
    html.ol(
      [],
      list.map(scores, fn(score) {
        html.li([], [
          element.text(
            { score.1 }.player.name <> ": " <> int.to_string({ score.1 }.score),
          ),
        ])
      }),
    ),
  ])
}

fn display_finished_round(
  finished_round: shared.FinishedRound,
  round_index: Int,
) {
  let is_leading_text = fn(id) {
    case id == finished_round.leading_player_id {
      True -> " (main player)"
      False -> ""
    }
  }

  ui.prose([attribute.class("border-solid border-2")], [
    html.h2([], [
      element.text("Round " <> int.to_string(round_index + 1) <> " scores:"),
    ]),
    html.div(
      [],
      list.sort(finished_round.player_scores, fn(a, b) {
        case
          a.player.id
          == finished_round.leading_player_id,
          b.player.id
          == finished_round.leading_player_id
        {
          True, _ -> order.Lt
          _, True -> order.Gt
          False, False -> int.compare(a.score, b.score)
        }
      })
        |> list.map(fn(player_score) {
          html.div([], [
            html.h3([], [
              element.text(
                player_score.player.name
                <> is_leading_text(player_score.player.id)
                <> " ("
                <> int.to_string(player_score.score)
                <> " points)",
              ),
            ]),
            html.ol(
              [],
              list.reverse(player_score.words)
                |> list.map(fn(word) { html.li([], [element.text(word)]) }),
            ),
          ])
        }),
    ),
  ])
}
