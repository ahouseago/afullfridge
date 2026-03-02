import gleam/http/response
import gleam/option.{type Option, None, Some}
import gleam/string
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
  JoinRoom(List(#(String, String)))
  UpdateRoomCode(String)
  ApiReturnedRoom(Result(shared.RoomResponse, rsvp.Error))
}

pub type Model {
  Model(uri: uri.Uri, room_code: String, join_room_err: Option(String))
}

pub fn init(uri: uri.Uri) -> Model {
  Model(uri, "", None)
}

pub fn update(msg: Msg, model: Model) -> #(Model, effect.Effect(Msg)) {
  case msg {
    UpdateRoomCode(room_code) -> #(Model(..model, room_code:), effect.none())
    JoinRoom([#("room-code-input", room_code)]) -> #(
      model,
      rsvp.post(
        server.url(model.uri, "/joinroom"),
        shared.join_room_request_to_json(
          shared.JoinRoomRequest(shared.id_from_string(room_code)),
        ),
        rsvp.expect_json(shared.room_response_decoder(), ApiReturnedRoom),
      ),
    )
    JoinRoom([]) -> #(model, effect.none())
    JoinRoom([#(_, _)]) -> #(model, effect.none())
    JoinRoom([_, ..]) -> #(model, effect.none())
    ApiReturnedRoom(Error(rsvp.HttpError(response.Response(status: 404, ..)))) -> #(
      Model(..model, join_room_err: Some("No game found with that room code.")),
      effect.none(),
    )
    ApiReturnedRoom(Error(_)) -> #(
      Model(
        ..model,
        join_room_err: Some("Failed to join room, please try again"),
      ),
      effect.none(),
    )
    ApiReturnedRoom(..) -> #(model, effect.none())
  }
}

pub fn view(model: Model) -> element.Element(Msg) {
  html.form(
    [event.on_submit(JoinRoom), class("flex flex-wrap items-center mx-4")],
    [
      html.label(
        [attribute.for("room-code-input"), class("flex-initial mr-2 mb-2")],
        [element.text("Enter game code:")],
      ),
      html.div([class("mb-2")], [
        html.input([
          attribute.name("room-code-input"),
          attribute.id("room-code-input"),
          attribute.placeholder("ABCD"),
          attribute.type_("text"),
          class(
            "mr-2 p-2 w-16 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono placeholder:opacity-50 tracking-widest",
          ),
          event.on_input(UpdateRoomCode),
          attribute.value(model.room_code),
        ]),
        html.button(
          [
            attribute.type_("submit"),
            attribute.disabled(string.length(string.trim(model.room_code)) != 4),
            class(
              "rounded px-3 py-2 border bg-sky-600 hover:bg-sky-500 text-white hover:shadow-md disabled:opacity-50 disabled:bg-sky-600 disabled:shadow-none",
            ),
          ],
          [element.text("Join")],
        ),
      ]),
      case model.join_room_err {
        Some(err) -> html.div([class("ml-2 text-red-800")], [element.text(err)])
        None -> element.none()
      },
    ],
  )
}
