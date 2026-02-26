import lustre/attribute
import lustre/element/html

pub fn view(href, content, class_name) {
  html.a(
    [
      attribute.class("p-2 underline border-solid rounded m-2 " <> class_name),
      attribute.href(href),
    ],
    content,
  )
}
