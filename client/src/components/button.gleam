import lustre/attribute
import lustre/element
import lustre/element/html

pub fn view(
  attrs: List(attribute.Attribute(a)),
  content: List(element.Element(a)),
  disabled: Bool,
) {
  html.button(
    [
      attribute.class("border-1 border-solid"),
      attribute.class("py-2 px-3 rounded-lg"),
      attribute.class("font-[Lacquer]"),
      attribute.disabled(disabled),
      case disabled {
        True ->
          attribute.class(
            "cursor-not-allowed bg-gray-200 border-gray-400 text-gray-500",
          )
        False ->
          attribute.class(
            "cursor-pointer hover:shadow-gray-800 hover:shadow-sm",
          )
      },
      ..attrs
    ],
    content,
  )
}
