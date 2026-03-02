import gleam/int
import gleam/option
import gleam/uri

const dev_mode = False

/// Handles getting the URL for API calls based on the environment.
pub fn url(uri: uri.Uri, path) -> String {
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
