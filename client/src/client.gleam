import gleam/dict
import gleam/int
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
import modem
import shared

pub type Model {
  Model(route: Route, room_code_input: String)
  InRoom(route: Route, player_id: Int, room: shared.Room, player_name: String)
}

pub type Route {
  Home
  JoinRoom(room_code: Option(String))
  Room(room_code: String)
  NotFound
}

pub type Msg {
  // ApiReturnedCat(Result(String, lustre_http.HttpError))
  OnRouteChange(Route)
  UpdateRoomCode(String)
  UpdatePlayerName(String)
  StartGame
  JoinedRoom(Result(shared.HttpResponse, lustre_http.HttpError))
  // UpdatePlayerName(String)
}

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}

fn init(_flags) -> #(Model, effect.Effect(Msg)) {
  case modem.initial_uri() |> result.map(get_route_from_uri) {
    Ok(JoinRoom(Some(room_code))) -> #(
      Model(JoinRoom(Some(room_code)), room_code),
      modem.init(on_url_change),
    )
    Ok(route) -> #(Model(route, ""), modem.init(on_url_change))
    Error(Nil) -> #(Model(Home, ""), modem.init(on_url_change))
  }
}

pub fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case model, msg {
    Model(_, _), StartGame -> #(model, start_game())
    Model(_, _), JoinedRoom(Ok(shared.RoomResponse(room, player_id))) -> {
      io.debug(player_id)
      #(
        InRoom(
          route: Room(room.room_code),
          player_id: player_id,
          room: room,
          player_name: "",
        ),
        effect.none(),
      )
    }
    Model(_, _), JoinedRoom(Error(err)) -> {
      io.debug(err)
      #(model, effect.none())
    }
    // ApiReturnedCat(Ok(_cat)) -> #(model, effect.none())
    // ApiReturnedCat(Error(_)) -> #(model, effect.none())
    Model(_route, room_code_input), OnRouteChange(route) -> #(
      Model(route, room_code_input),
      effect.none(),
    )
    Model(route, _room_code_input), UpdateRoomCode(room_code) -> #(
      Model(route, room_code),
      effect.none(),
    )
    Model(_, _), UpdatePlayerName(_) -> #(model, effect.none())
    InRoom(route, player_id, room, _player_name), UpdatePlayerName(player_name) -> #(
      InRoom(route, player_id, room, player_name),
      effect.none(),
    )
    InRoom(_route, _player_id, _room, _player_name), _ -> #(
      model,
      effect.none(),
    )
  }
}

fn start_game() {
  lustre_http.get(
    "http://localhost:3000/createroom",
    lustre_http.expect_json(shared.decode_http_response_json, JoinedRoom),
  )
}

fn get_route_from_uri(uri: uri.Uri) -> Route {
  let room_code =
    uri.query
    |> option.map(uri.parse_query)
    |> option.then(fn(query) {
      case query {
        Ok([#("room", room_code)]) -> Some(room_code)
        _ -> None
      }
    })
  case uri.path_segments(uri.path), room_code {
    [""], _ | [], _ -> Home
    ["join"], room_code -> JoinRoom(room_code)
    _, _ -> NotFound
  }
}

fn on_url_change(uri: uri.Uri) -> Msg {
  get_route_from_uri(uri) |> OnRouteChange
}

// fn get_cat() -> effect.Effect(Msg) {
//   let decoder = dynamic.field("_id", dynamic.string)
//   let expect = lustre_http.expect_json(decoder, ApiReturnedCat)
//
//   lustre_http.get("https://cataas.com/cat?json=true", expect)
// }
//

pub fn view(model: Model) -> element.Element(Msg) {
  let content = content(model)

  html.div([], [
    header(model.route),
    // html.button([event.on_click(UserIncrementedCount)], [element.text("+")]),
    content,
    // html.button([event.on_click(UserDecrementedCount)], [element.text("-")]),
  ])
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

fn header(route: Route) {
  case route {
    Home ->
      html.h1([attribute.class("text-4xl my-10 text-center")], [
        element.text("A Full Fridge"),
      ])
    // CreateRoom ->
    //   html.div([], [
    //     html.nav([attribute.class("flex items-center")], [
    //       link("/", [element.text("Home")]),
    //       html.h1([attribute.class("text-2xl my-5")], [
    //         element.text("Start new game"),
    //       ]),
    //     ]),
    //   ])
    JoinRoom(Some(_)) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [
          element.text("Joining game..."),
        ]),
      ])
    JoinRoom(None) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [element.text("Join game")]),
      ])
    Room(room_code) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          // link("/", [element.text("Leave game")]),
        ]),
        html.h1([attribute.class("text-2xl my-5")], [
          element.text("Game: " <> room_code),
        ]),
      ])
    NotFound ->
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
    Model(Home, _) ->
      html.div([], [
        html.p([attribute.class("mx-4 text-lg")], [
          element.text("Welcome to "),
          html.span([], [element.text("A Full Fridge")]),
          element.text(", a game about preferences best played with friends."),
        ]),
        html.button([event.on_click(StartGame)], [
          element.text("Start new game"),
        ]),
        // link("/create", [element.text("Start new game")]),
        link("/join", [element.text("Join a game")]),
      ])
    // CreateRoom ->
    //   html.div([attribute.class("flex flex-col m-4")], [
    //     html.label([attribute.for("name-input")], [element.text("Name:")]),
    //     html.input([
    //       attribute.id("name-input"),
    //       attribute.placeholder("Enter name..."),
    //       attribute.type_("text"),
    //       attribute.class(
    //         "my-2 p-2 border-2 rounded placeholder:text-slate-300",
    //       ),
    //     ]),
    //   ])
    Model(JoinRoom(Some(room_code)), _) ->
      element.text("Joining room " <> room_code <> "...")
    Model(JoinRoom(None), room_code_input) ->
      html.div([attribute.class("flex flex-col m-4")], [
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
      ])
    InRoom(Room(room_code), player_id, room, player_name) ->
      html.div([attribute.class("flex flex-col m-4")], [
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
        html.div([], [
          html.h2([], [element.text("Players:")]),
          html.ul(
            [],
            list.map(dict.values(room.players), fn(player) {
              let display =
                case player.name, player.id {
                  "", id -> int.to_string(id)
                  name, _ -> name
                }
                |> element.text
              html.li([], [display])
            }),
          ),
        ]),
      ])
    Model(NotFound, _) | _ -> element.text("Page not found")
  }
}