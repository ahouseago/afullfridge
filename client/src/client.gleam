import gleam/io
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/uri
import lustre
import lustre/attribute
import lustre/effect
import lustre/element
import lustre/element/html
import lustre/event
import lustre_http
import lustre_websocket as ws
import modem
import shared

pub type Model {
  NotInRoom(uri: uri.Uri, route: Route, room_code_input: String)
  Disconnected(
    player_id: shared.PlayerId,
    room_code: shared.RoomCode,
    player_name: String,
  )
  Connected(
    player_id: shared.PlayerId,
    room_code: shared.RoomCode,
    player_name: String,
    ws: ws.WebSocket,
    room: Option(shared.Room),
    round: Option(shared.Round),
  )
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
  AddWord
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
    Ok(uri), Ok(Play(Some(room_code))) -> #(
      NotInRoom(uri, Play(Some(room_code)), room_code),
      effect.batch([join_game(room_code), modem.init(on_url_change)]),
    )
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
        Disconnected(
          player_id: player_id,
          room_code: room_code,
          player_name: "",
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
      NotInRoom(uri, route, room_code),
      effect.none(),
    )
    NotInRoom(_, _, room_code_input), JoinGame -> #(
      model,
      join_game(room_code_input),
    )
    NotInRoom(_, _, _), UpdatePlayerName(_) -> #(model, effect.none())
    NotInRoom(_, _, _), _ -> #(model, effect.none())
    Disconnected(player_id, room_code, _player_name),
      UpdatePlayerName(player_name)
    -> #(Disconnected(player_id, room_code, player_name), effect.none())
    Disconnected(player_id, _room_code, player_name), SetPlayerName -> #(
      model,
      ws.init(
        "ws://localhost:3000/ws/" <> player_id <> "/" <> player_name,
        WebSocketEvent,
      ),
    )
    Disconnected(player_id, room_code, player_name), WebSocketEvent(ws_event)
    | Connected(player_id, room_code, player_name, _, _, _),
      WebSocketEvent(ws_event)
    -> {
      case ws_event {
        ws.InvalidUrl -> panic
        ws.OnOpen(socket) -> #(
          Connected(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
            ws: socket,
            room: None,
            round: None,
          ),
          effect.none(),
        )
        ws.OnTextMessage(msg) -> handle_ws_message(model, msg)
        ws.OnBinaryMessage(_msg) -> #(model, effect.none())
        ws.OnClose(_reason) -> #(
          Disconnected(player_id, room_code, player_name),
          effect.none(),
        )
      }
    }
    Connected(_player_id, _room_code, _player_name, ws, _room, _round), AddWord -> {
      #(model, ws.send(ws, shared.encode_request(shared.AddWord("something"))))
    }
    Connected(_player_id, _room_code, _player_name, _ws, _room, _round), _
    | Disconnected(_player_id, _room, _player_name), _
    -> #(model, effect.none())
  }
}

fn handle_ws_message(model: Model, msg: String) -> #(Model, effect.Effect(Msg)) {
  case model {
    NotInRoom(_, _, _) | Disconnected(_, _, _) -> #(model, effect.none())
    Connected(player_id, room_code, player_name, ws, room, round) ->
      case shared.decode_websocket_response(msg) {
        Ok(shared.InitialRoomState(room)) -> #(
          Connected(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
            ws: ws,
            room: Some(room),
            round: round,
          ),
          effect.none(),
        )
        Ok(shared.PlayersInRoom(player_list)) -> {
          let room =
            option.map(room, fn(room) {
              shared.Room(..room, players: player_list)
            })
          #(
            Connected(
              player_id: player_id,
              room_code: room_code,
              player_name: player_name,
              ws: ws,
              room: room,
              round: round,
            ),
            effect.none(),
          )
        }
        Ok(shared.WordList(word_list)) -> {
          let room =
            option.map(room, fn(room) {
              shared.Room(..room, word_list: word_list)
            })
          #(
            Connected(
              player_id: player_id,
              room_code: room_code,
              player_name: player_name,
              ws: ws,
              room: room,
              round: round,
            ),
            effect.none(),
          )
        }
        Ok(shared.RoundInfo(round)) -> #(
          Connected(
            player_id: player_id,
            room_code: room_code,
            player_name: player_name,
            ws: ws,
            room: room,
            round: Some(round),
          ),
          effect.none(),
        )
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

  html.div([], [header(model), content])
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
    Connected(_, room_code, _, _, _, _) | Disconnected(_, room_code, _) ->
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
        html.button([event.on_click(StartGame)], [
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
          html.input([
            attribute.id("room-code-input"),
            attribute.placeholder("glittering-intelligent-iguana"),
            attribute.type_("text"),
            attribute.class(
              "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono",
            ),
            event.on_input(UpdateRoomCode),
            attribute.value(room_code_input),
          ]),
          html.button([attribute.type_("submit")], [element.text("Join")]),
        ],
      )
    Connected(player_id, _room_code, _player_name, _ws, Some(room), _round) ->
      html.div([attribute.class("flex flex-col m-4")], [
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
      ])
    Disconnected(_player_id, _room_code, player_name) ->
      html.div([attribute.class("flex flex-col m-4")], [
        html.form(
          [event.on_submit(SetPlayerName), attribute.class("flex flex-col m-4")],
          [
            html.label([attribute.for("name-input")], [element.text("Name:")]),
            html.input([
              attribute.id("name-input"),
              attribute.placeholder("Enter name..."),
              event.on_input(UpdatePlayerName),
              attribute.value(player_name),
              attribute.type_("text"),
              attribute.class(
                "my-2 p-2 border-2 rounded placeholder:text-slate-300",
              ),
            ]),
            html.button([attribute.type_("submit")], [element.text("Set name")]),
          ],
        ),
      ])
    Connected(_player_id, room_code, player_name, _ws, None, _round) -> {
      html.div([attribute.class("flex flex-col m-4")], [
        html.div([], [
          html.h2([], [element.text(player_name)]),
          element.text("Connecting to room " <> room_code <> "..."),
        ]),
        html.button([event.on_click(AddWord)], [element.text("Add word")]),
      ])
    }
    NotInRoom(_, NotFound, _) | _ -> element.text("Page not found")
  }
}
