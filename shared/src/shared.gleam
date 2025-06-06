import gleam/dynamic/decode
import gleam/json
import gleam/option.{type Option}
import gleam/result

pub type HttpRequest {
  CreateRoomRequest
  JoinRoomRequest(room_code: Id(Room))
  ValidateNameRequest(player_id: Id(Player), name: String)
}

pub fn http_request_decoder() -> decode.Decoder(HttpRequest) {
  use variant <- decode.field("type", decode.string)
  case variant {
    "create_room_request" -> decode.success(CreateRoomRequest)
    "join_room_request" -> {
      use room_code <- decode.field("room_code", id_decoder())
      decode.success(JoinRoomRequest(room_code:))
    }
    "validate_name_request" -> {
      use player_id <- decode.field("player_id", id_decoder())
      use name <- decode.field("name", decode.string)
      decode.success(ValidateNameRequest(player_id:, name:))
    }
    request_type ->
      decode.failure(
        CreateRoomRequest,
        "HttpRequest: unknown request type: " <> request_type,
      )
  }
}

pub fn encode_http_request(http_request: HttpRequest) -> json.Json {
  case http_request {
    CreateRoomRequest ->
      json.object([#("type", json.string("create_room_request"))])
    JoinRoomRequest(room_code) ->
      json.object([
        #("type", json.string("join_room_request")),
        #("room_code", room_code |> encode_id),
      ])
    ValidateNameRequest(player_id, name) ->
      json.object([
        #("type", json.string("validate_name_request")),
        #("player_id", player_id |> encode_id),
        #("name", name |> json.string),
      ])
  }
}

pub type HttpResponse {
  // Returned from successfully creating/joining a room.
  RoomResponse(room_code: Id(Room), player_id: Id(Player))
  ValidateNameResponse(valid: Bool)
}

pub fn http_response_decoder() -> decode.Decoder(HttpResponse) {
  use variant <- decode.field("type", decode.string)
  case variant {
    "room_response" -> {
      use room_code <- decode.field("room_code", id_decoder())
      use player_id <- decode.field("player_id", id_decoder())
      decode.success(RoomResponse(room_code:, player_id:))
    }
    "validate_name_response" -> {
      use valid <- decode.field("valid", decode.bool)
      decode.success(ValidateNameResponse(valid:))
    }
    str ->
      decode.failure(
        ValidateNameResponse(False),
        "HttpResponse: unknown response: " <> str,
      )
  }
}

pub fn encode_http_response(http_response: HttpResponse) -> json.Json {
  case http_response {
    RoomResponse(..) ->
      json.object([
        #("type", json.string("room_response")),
        #("room_code", http_response.room_code |> encode_id),
        #("player_id", http_response.player_id |> encode_id),
      ])
    ValidateNameResponse(..) ->
      json.object([
        #("type", json.string("validate_name_response")),
        #("valid", json.bool(http_response.valid)),
      ])
  }
}

pub type WebsocketRequest {
  AddWord(word: String)
  AddRandomWord
  RemoveWord(word: String)
  ListWords
  StartRound
  SubmitOrderedWords(words: List(String))
  RemovePlayer(player_id: Id(Player))
}

pub fn websocket_request_decoder() -> decode.Decoder(WebsocketRequest) {
  use variant <- decode.field("type", decode.string)
  case variant {
    "add_word" -> {
      use word <- decode.field("word", decode.string)
      decode.success(AddWord(word:))
    }
    "add_random_word" -> decode.success(AddRandomWord)
    "remove_word" -> {
      use word <- decode.field("word", decode.string)
      decode.success(RemoveWord(word:))
    }
    "list_words" -> decode.success(ListWords)
    "start_round" -> decode.success(StartRound)
    "submit_ordered_words" -> {
      use words <- decode.field("words", decode.list(decode.string))
      decode.success(SubmitOrderedWords(words:))
    }
    "remove_player" -> {
      use player_id <- decode.field("player_id", id_decoder())
      decode.success(RemovePlayer(player_id:))
    }
    request_type ->
      decode.failure(
        AddRandomWord,
        "WebsocketRequest type unknown: " <> request_type,
      )
  }
}

pub fn encode_websocket_request(
  websocket_request: WebsocketRequest,
) -> json.Json {
  case websocket_request {
    AddWord(..) ->
      json.object([
        #("type", json.string("add_word")),
        #("word", json.string(websocket_request.word)),
      ])
    AddRandomWord -> json.object([#("type", json.string("add_random_word"))])
    RemoveWord(..) ->
      json.object([
        #("type", json.string("remove_word")),
        #("word", json.string(websocket_request.word)),
      ])
    ListWords -> json.object([#("type", json.string("list_words"))])
    StartRound -> json.object([#("type", json.string("start_round"))])
    SubmitOrderedWords(..) ->
      json.object([
        #("type", json.string("submit_ordered_words")),
        #("words", json.array(websocket_request.words, json.string)),
      ])
    RemovePlayer(player_id) ->
      json.object([
        #("type", json.string("remove_player")),
        #("player_id", player_id |> encode_id),
      ])
  }
}

pub type WebsocketResponse {
  // Sent after connecting to a room.
  InitialRoomState(room: Room)
  PlayersInRoom(players: List(Player))
  WordList(word_list: List(String))
  RoundInfo(round: Round)
  RoundResult(finished_round: FinishedRound)
  ServerError(reason: String)
  Kicked
}

pub fn websocket_response_decoder() -> decode.Decoder(WebsocketResponse) {
  use variant <- decode.field("type", decode.string)
  case variant {
    "initial_room_state" -> {
      use room <- decode.field("room", room_decoder())
      decode.success(InitialRoomState(room:))
    }
    "players_in_room" -> {
      use players <- decode.field("players", decode.list(player_decoder()))
      decode.success(PlayersInRoom(players:))
    }
    "word_list" -> {
      use word_list <- decode.field("word_list", decode.list(decode.string))
      decode.success(WordList(word_list:))
    }
    "round_info" -> {
      use round <- decode.field("round", round_decoder())
      decode.success(RoundInfo(round:))
    }
    "round_result" -> {
      use finished_round <- decode.field(
        "finished_round",
        finished_round_decoder(),
      )
      decode.success(RoundResult(finished_round:))
    }
    "server_error" -> {
      use reason <- decode.field("reason", decode.string)
      decode.success(ServerError(reason:))
    }
    "kicked" -> decode.success(Kicked)
    response_type ->
      decode.failure(Kicked, "WebsocketResponse: " <> response_type)
  }
}

pub fn encode_websocket_response(
  websocket_response: WebsocketResponse,
) -> json.Json {
  case websocket_response {
    InitialRoomState(..) ->
      json.object([
        #("type", json.string("initial_room_state")),
        #("room", encode_room(websocket_response.room)),
      ])
    PlayersInRoom(..) ->
      json.object([
        #("type", json.string("players_in_room")),
        #("players", json.array(websocket_response.players, encode_player)),
      ])
    WordList(..) ->
      json.object([
        #("type", json.string("word_list")),
        #("word_list", json.array(websocket_response.word_list, json.string)),
      ])
    RoundInfo(..) ->
      json.object([
        #("type", json.string("round_info")),
        #("round", encode_round(websocket_response.round)),
      ])
    RoundResult(..) ->
      json.object([
        #("type", json.string("round_result")),
        #(
          "finished_round",
          encode_finished_round(websocket_response.finished_round),
        ),
      ])
    ServerError(..) ->
      json.object([
        #("type", json.string("server_error")),
        #("reason", json.string(websocket_response.reason)),
      ])
    Kicked -> json.object([#("type", json.string("kicked"))])
  }
}

pub opaque type Id(a) {
  Id(String)
}

pub fn id_to_string(id: Id(a)) -> String {
  let Id(id) = id
  id
}

fn encode_id(id: Id(a)) -> json.Json {
  id |> id_to_string |> json.string
}

fn id_decoder() -> decode.Decoder(Id(a)) {
  decode.then(decode.string, fn(str) { decode.success(Id(str)) })
}

pub fn id_from_string(id: String) -> Id(a) {
  Id(id)
}

pub type Player {
  Player(id: Id(Player), name: String, connected: Bool)
}

fn player_decoder() -> decode.Decoder(Player) {
  use id <- decode.field("id", decode.string)
  use name <- decode.field("name", decode.string)
  use connected <- decode.field("connected", decode.bool)
  decode.success(Player(id: Id(id), name:, connected:))
}

fn encode_player(player: Player) -> json.Json {
  json.object([
    #("id", player.id |> encode_id),
    #("name", player.name |> json.string),
    #("connected", json.bool(player.connected)),
  ])
}

pub type PlayerWithOrderedPreferences =
  #(Id(Player), List(String))

/// Round represents a round of the game within a room, where one player is
/// selecting their order of preferences out of some given list of words, and the
/// other players are trying to guess that ordering.
pub type Round {
  Round(
    words: List(String),
    // The player who everyone is trying to guess the preference order of.
    leading_player_id: Id(Player),
    // The other players who have submitted.
    submitted: List(Id(Player)),
  )
}

fn round_decoder() -> decode.Decoder(Round) {
  use words <- decode.field("words", decode.list(decode.string))
  use leading_player_id <- decode.field("leading_player_id", id_decoder())
  use submitted <- decode.field("submitted", decode.list(id_decoder()))
  decode.success(Round(words:, leading_player_id:, submitted:))
}

fn encode_round(round: Round) -> json.Json {
  json.object([
    #("words", json.array(round.words, json.string)),
    #("leading_player_id", round.leading_player_id |> encode_id),
    #("submitted", json.array(round.submitted, encode_id)),
  ])
}

pub type FinishedRound {
  FinishedRound(
    words: List(String),
    leading_player_id: Id(Player),
    player_scores: List(PlayerScore),
  )
}

fn finished_round_decoder() -> decode.Decoder(FinishedRound) {
  use words <- decode.field("words", decode.list(decode.string))
  use leading_player_id <- decode.field("leading_player_id", id_decoder())
  use player_scores <- decode.field(
    "player_scores",
    decode.list(player_score_decoder()),
  )
  decode.success(FinishedRound(words:, leading_player_id:, player_scores:))
}

fn encode_finished_round(finished_round: FinishedRound) -> json.Json {
  json.object([
    #("words", json.array(finished_round.words, json.string)),
    #("leading_player_id", finished_round.leading_player_id |> encode_id),
    #(
      "player_scores",
      json.array(finished_round.player_scores, encode_player_score),
    ),
  ])
}

pub type PlayerScore {
  PlayerScore(player: Player, words: List(String), score: Int)
}

fn player_score_decoder() -> decode.Decoder(PlayerScore) {
  use player <- decode.field("player", player_decoder())
  use words <- decode.field("words", decode.list(decode.string))
  use score <- decode.field("score", decode.int)
  decode.success(PlayerScore(player:, words:, score:))
}

fn encode_player_score(player_score: PlayerScore) -> json.Json {
  json.object([
    #("player", encode_player(player_score.player)),
    #("words", json.array(player_score.words, json.string)),
    #("score", json.int(player_score.score)),
  ])
}

pub type ScoringMethod {
  // Scores one point for exactly matching the correct list.
  ExactMatch
  // Scores one point for every entry that is in the same position as the same
  // entry in the correct list.
  EqualPositions
  // Smart scoring awards points from 0 to 8, with 5 points as the highest
  // score with a single adjacent pair swapped.
  Smart
}

fn scoring_method_decoder() -> decode.Decoder(ScoringMethod) {
  use variant <- decode.then(decode.string)
  case variant {
    "exact_match" -> decode.success(ExactMatch)
    "equal_positions" -> decode.success(EqualPositions)
    "smart" -> decode.success(Smart)
    str -> decode.failure(ExactMatch, "ScoringMethod unknown: " <> str)
  }
}

fn encode_scoring_method(scoring_method: ScoringMethod) -> json.Json {
  case scoring_method {
    ExactMatch -> json.string("exact_match")
    EqualPositions -> json.string("equal_positions")
    Smart -> json.string("smart")
  }
}

pub type Room {
  Room(
    room_code: Id(Room),
    players: List(Player),
    // All of the words that can be chosen from to create a round.
    word_list: List(String),
    round: Option(Round),
    finished_rounds: List(FinishedRound),
    scoring_method: ScoringMethod,
  )
}

fn room_decoder() -> decode.Decoder(Room) {
  use room_code <- decode.field("room_code", id_decoder())
  use players <- decode.field("players", decode.list(player_decoder()))
  use word_list <- decode.field("word_list", decode.list(decode.string))
  use round <- decode.field("round", decode.optional(round_decoder()))
  use finished_rounds <- decode.field(
    "finished_rounds",
    decode.list(finished_round_decoder()),
  )
  use scoring_method <- decode.field("scoring_method", scoring_method_decoder())
  decode.success(Room(
    room_code:,
    players:,
    word_list:,
    round:,
    finished_rounds:,
    scoring_method:,
  ))
}

fn encode_room(room: Room) -> json.Json {
  json.object([
    #("room_code", room.room_code |> encode_id),
    #("players", json.array(room.players, encode_player)),
    #("word_list", json.array(room.word_list, json.string)),
    #("round", case room.round {
      option.None -> json.null()
      option.Some(value) -> encode_round(value)
    }),
    #(
      "finished_rounds",
      json.array(room.finished_rounds, encode_finished_round),
    ),
    #("scoring_method", encode_scoring_method(room.scoring_method)),
  ])
}

pub fn decode(str: String, with decoder: decode.Decoder(a)) -> Result(a, String) {
  json.parse(str, decoder) |> result.map_error(json_decode_err_to_string)
}

pub fn encode(a, with encoder: fn(a) -> json.Json) -> String {
  encoder(a) |> json.to_string
}

fn json_decode_err_to_string(err: json.DecodeError) -> String {
  case err {
    json.UnableToDecode(_) -> "UnableToDecode"
    json.UnexpectedByte(x) -> "UnexpectedByte: " <> x
    json.UnexpectedEndOfInput -> "UnexpectedEndOfInput"
    json.UnexpectedFormat(_) -> "UnexpectedFormat"
    json.UnexpectedSequence(x) -> "UnexpectedSequence: " <> x
  }
}
