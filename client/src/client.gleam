import gleam/dynamic
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
  Model(route: Route, room_code: Option(String), room_code_input: String)
  // InRoom(room_code: String, player_name: Option(String))
}

pub type Route {
  Home
  CreateRoom
  JoinRoom(room_code: Option(String))
  NotFound
}

pub type Msg {
  ApiReturnedCat(Result(String, lustre_http.HttpError))
  OnRouteChange(Route)
  UpdateRoomCode(String)
  // UpdatePlayerName(String)
}

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)

  Nil
}

fn init(_flags) -> #(Model, effect.Effect(Msg)) {
  case modem.initial_uri() |> result.map(get_route_from_uri) {
    Ok(JoinRoom(room_code)) -> #(
      Model(JoinRoom(room_code), room_code, ""),
      modem.init(on_url_change),
    )
    Ok(route) -> #(Model(route, None, ""), modem.init(on_url_change))
    Error(Nil) -> #(Model(Home, None, ""), modem.init(on_url_change))
  }
}

pub fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case msg {
    ApiReturnedCat(Ok(cat)) -> #(model, effect.none())
    ApiReturnedCat(Error(_)) -> #(model, effect.none())
    OnRouteChange(route) -> #(Model(..model, route: route), effect.none())
    UpdateRoomCode(room_code) -> #(
      Model(..model, room_code: Some(room_code)),
      effect.none(),
    )
  }
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
    ["create"], _ -> CreateRoom
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
    CreateRoom ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
          html.h1([attribute.class("text-2xl my-5")], [
            element.text("Start new game"),
          ]),
        ]),
      ])
    JoinRoom(Some(_)) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
          html.h1([attribute.class("text-2xl my-5")], [
            element.text("Joining game..."),
          ]),
        ]),
      ])
    JoinRoom(None) ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
          html.h1([attribute.class("text-2xl my-5")], [
            element.text("Join game"),
          ]),
        ]),
      ])
    NotFound ->
      html.div([], [
        html.nav([attribute.class("flex items-center")], [
          link("/", [element.text("Home")]),
          html.h1([attribute.class("text-2xl my-5")], [
            element.text("Page not found"),
          ]),
        ]),
      ])
  }
}

fn content(model: Model) {
  case model.route {
    Home ->
      html.div([], [
        html.p([attribute.class("mx-4 text-lg")], [
          element.text("Welcome to "),
          html.span([], [element.text("A Full Fridge")]),
          element.text(", a game about preferences best played with friends."),
        ]),
        link("/create", [element.text("Start new game")]),
        link("/join", [element.text("Join a game")]),
      ])
    CreateRoom ->
      html.div([attribute.class("flex flex-col m-4")], [
        html.label([attribute.for("name-input")], [element.text("Name:")]),
        html.input([
          attribute.id("name-input"),
          attribute.placeholder("Enter name..."),
          attribute.type_("text"),
          attribute.class(
            "my-2 p-2 border-2 rounded placeholder:text-slate-300",
          ),
        ]),
      ])
    JoinRoom(Some(room_code)) ->
      element.text("Joining room " <> room_code <> "...")
    JoinRoom(None) ->
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
          attribute.value(model.room_code |> option.unwrap("")),
        ]),
      ])
    NotFound -> element.text("Page not found")
  }
}
