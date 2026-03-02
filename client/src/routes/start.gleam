import components/link
import gleam/http/response
import gleam/option.{type Option, None, Some}
import gleam/uri
import lustre/attribute.{class}
import lustre/effect
import lustre/element
import lustre/element/html
import lustre/event
import rsvp
import server
import shared

pub type Msg {
  StartGame
  ApiReturnedRoom(Result(shared.RoomResponse, rsvp.Error))
}

pub type Model {
  Model(uri: uri.Uri, join_room_err: Option(String))
}

pub fn init(uri: uri.Uri) -> Model {
  Model(uri, None)
}

pub fn update(msg: Msg, model: Model) -> #(Model, effect.Effect(Msg)) {
  case msg {
    StartGame -> #(
      model,
      rsvp.get(
        server.url(model.uri, "/createroom"),
        rsvp.expect_json(shared.room_response_decoder(), ApiReturnedRoom),
      ),
    )
    ApiReturnedRoom(Error(rsvp.HttpError(response.Response(status: 404, ..)))) -> #(
      Model(model.uri, Some("No game found with that room code.")),
      effect.none(),
    )
    ApiReturnedRoom(Error(_)) -> #(
      Model(model.uri, Some("Failed to create room, please try again")),
      effect.none(),
    )
    // This is handled in the parent
    ApiReturnedRoom(Ok(..)) -> #(model, effect.none())
  }
}

pub fn view(model: Model) -> element.Element(Msg) {
  html.div([class("text-center")], [
    case model.join_room_err {
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
          class("w-36 p-2 bg-green-700 text-white rounded hover:bg-green-600"),
        ],
        [element.text("Start new game")],
      ),
      link.view(
        "/join",
        [element.text("Join a game")],
        "w-36 text-white bg-sky-600 rounded hover:bg-sky-500 no-underline",
      ),
    ]),
  ])
}
