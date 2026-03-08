import components/button
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import icon
import lustre/attribute
import lustre/effect
import lustre/element
import lustre/element/html
import lustre/event
import shared

pub type Model {
  Model(
    player_id: shared.Id(shared.Player),
    room: shared.Room,
    round: shared.Round,
    ordered_words: List(String),
    submitted: Bool,
    dragging: Option(element.Element(Msg)),
  )
}

pub type Msg {
  OnPointerDown(target: element.Element(Msg))
  OnPointerMove
  OnPointerUp
  AddNextPreferedWord(String)
  ClearOrderedWords
  SubmitOrderedWords
}

pub fn update(model: Model, msg: Msg) -> #(Model, effect.Effect(Msg)) {
  case msg {
    OnPointerDown(target) -> #(
      Model(..model, dragging: Some(target)),
      effect.none(),
    )
    _ -> todo
  }
}

fn choosing_player_heading(
  players: List(shared.Player),
  self_player_id: shared.Id(shared.Player),
  leading_player_id: shared.Id(shared.Player),
) {
  list.find(players, fn(player) { player.id == leading_player_id })
  |> result.map(fn(player) {
    case player.id == self_player_id {
      False -> "You are guessing " <> player.name <> "'s order of preference"
      True -> "It's your turn! Select the things below in your preference order"
    }
  })
  |> result.unwrap("Select the options below in order")
}

pub fn view(model: Model) {
  html.div([attribute.class("flex flex-col max-w-2xl mx-auto")], [
    html.div([attribute.class("m-4")], [
      html.h2([attribute.class("text-lg mb-2")], [
        element.text(choosing_player_heading(
          model.room.players,
          model.player_id,
          model.round.leading_player_id,
        )),
      ]),
      html.div(
        [attribute.class("flex flex-col flex-wrap")],
        list.map(model.round.words, fn(word) {
          let bg_colour = case
            list.find(model.ordered_words, fn(w) { w == word })
          {
            Ok(_) -> "bg-green-50"
            Error(_) -> ""
          }
          let el =
            html.div(
              [
                attribute.class(
                  "p-2 m-1 rounded border border-slate-200 hover:shadow-md "
                  <> bg_colour,
                ),
              ],
              [element.text(word)],
            )
          html.div(
            [
              event.on_mouse_down(OnPointerDown(el)),
            ],
            [el],
          )
        }),
      ),
      case model.dragging {
        Some(el) ->
          html.div(
            [attribute.class("position-absolute border-2 border-dashed")],
            [el],
          )
        None -> element.none()
      },
      html.ol(
        [attribute.class("list-decimal list-inside p-3")],
        list.reverse(model.ordered_words)
          |> list.map(fn(word) { html.li([], [element.text(word)]) }),
      ),
      html.div([attribute.class("mb-4 flex items-center justify-between")], [
        button.view(
          [
            event.on_click(ClearOrderedWords),
            attribute.class(
              "py-2 px-3 rounded m-2 bg-red-100 text-red-800 hover:shadow-md hover:bg-red-200 disabled:bg-red-100 disabled:opacity-50 disabled:shadow-none",
            ),
          ],
          [element.text("clear"), icon.x([attribute.class("ml-2 inline")])],
          model.ordered_words == [] || model.submitted,
        ),
        button.view(
          [
            event.on_click(SubmitOrderedWords),
            attribute.class(
              "py-2 px-3 m-2 rounded bg-green-100 text-green-900 hover:shadow-md hover:bg-green-200 disabled:green-50 disabled:opacity-50 disabled:shadow-none",
            ),
          ],
          [
            element.text("submit"),
            icon.check([attribute.class("ml-2 inline")]),
          ],
          list.length(model.ordered_words) != list.length(model.round.words)
            || model.submitted,
        ),
      ]),
      case model.submitted {
        True ->
          html.div([], [
            html.h6([], [element.text("Waiting for other players:")]),
            html.ul(
              [attribute.class("list-disc list-inside p-2")],
              list.filter_map(model.room.players, fn(player) {
                case list.contains(model.round.submitted, player.id) {
                  False -> Ok(html.li([], [element.text(player.name)]))
                  True -> Error(Nil)
                }
              }),
            ),
          ])
        False -> element.none()
      },
    ]),
  ])
}
