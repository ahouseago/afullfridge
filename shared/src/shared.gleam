import gleam/dynamic/decode
import gleam/json
import gleam/option.{type Option}
import gleam/result

pub type PlayerName {
  PlayerName(String)
}

pub type PlayerId {
  PlayerId(String)
}

pub type RoomCode {
  RoomCode(String)
}

pub type HttpRequest {
  CreateRoomRequest
  JoinRoomRequest(room_code: RoomCode)
}

pub fn http_request_decoder() -> decode.Decoder(HttpRequest) {
  use variant <- decode.field("type", decode.string)
  case variant {
    "create_room_request" -> decode.success(CreateRoomRequest)
    "join_room_request" -> {
      use room_code <- decode.field("room_code", string_decoder(RoomCode))
      decode.success(JoinRoomRequest(room_code:))
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
        #("room_code", room_code |> string_encoder(room_code_to_string)),
      ])
  }
}

pub type HttpResponse {
  // Returned from successfully creating/joining a room.
  RoomResponse(room_code: RoomCode, player_id: PlayerId)
}

pub fn http_response_decoder() -> decode.Decoder(HttpResponse) {
  use room_code <- decode.field("room_code", string_decoder(RoomCode))
  use player_id <- decode.field("player_id", string_decoder(PlayerId))
  decode.success(RoomResponse(room_code:, player_id:))
}

pub fn encode_http_response(http_response: HttpResponse) -> json.Json {
  json.object([
    #(
      "room_code",
      http_response.room_code |> string_encoder(room_code_to_string),
    ),
    #(
      "player_id",
      http_response.player_id |> string_encoder(player_id_to_string),
    ),
  ])
}

pub type WebsocketRequest {
  AddWord(word: String)
  AddRandomWord
  RemoveWord(word: String)
  ListWords
  StartRound
  SubmitOrderedWords(words: List(String))
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
    request_type ->
      decode.failure(
        AddRandomWord,
        "WebsocketRequest type unknown: " <> request_type,
      )
  }
}

pub fn encode_websocket_request(websocket_request: WebsocketRequest) -> json.Json {
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
  }
}

pub type WebsocketResponse {
  UnknownResponse(response_type: String)
  // Sent after connecting to a room.
  InitialRoomState(room: Room)
  PlayersInRoom(players: List(Player))
  WordList(word_list: List(String))
  RoundInfo(round: Round)
  RoundResult(finished_round: FinishedRound)
  ServerError(reason: String)
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
    response_type ->
      decode.failure(UnknownResponse(response_type), "WebsocketResponse")
  }
}

pub fn encode_websocket_response(websocket_response: WebsocketResponse) -> json.Json {
  case websocket_response {
    UnknownResponse(..) ->
      json.object([
        #("type", json.string("unknown_response")),
        #("response_type", json.string(websocket_response.response_type)),
      ])
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
  }
}

pub type Player {
  Player(id: PlayerId, name: PlayerName, connected: Bool)
}

fn player_decoder() -> decode.Decoder(Player) {
  use id <- decode.field("id", decode.string)
  use name <- decode.field("name", decode.string)
  use connected <- decode.field("connected", decode.bool)
  decode.success(Player(id: PlayerId(id), name: PlayerName(name), connected:))
}

fn encode_player(player: Player) -> json.Json {
  json.object([
    #("id", player.id |> string_encoder(player_id_to_string)),
    #("name", player.name |> string_encoder(player_name_to_string)),
    #("connected", json.bool(player.connected)),
  ])
}

pub type PlayerWithOrderedPreferences =
  #(PlayerId, List(String))

/// Round represents a round of the game within a room, where one player is
/// selecting their order of preferences out of some given list of words, and the
/// other players are trying to guess that ordering.
pub type Round {
  Round(
    words: List(String),
    // The player who everyone is trying to guess the preference order of.
    leading_player_id: PlayerId,
    // The other players who have submitted.
    submitted: List(PlayerId),
  )
}

fn round_decoder() -> decode.Decoder(Round) {
  use words <- decode.field("words", decode.list(decode.string))
  use leading_player_id <- decode.field(
    "leading_player_id",
    string_decoder(PlayerId),
  )
  use submitted <- decode.field(
    "submitted",
    decode.list(string_decoder(PlayerId)),
  )
  decode.success(Round(words:, leading_player_id:, submitted:))
}

fn encode_round(round: Round) -> json.Json {
  json.object([
    #("words", json.array(round.words, json.string)),
    #(
      "leading_player_id",
      round.leading_player_id |> string_encoder(player_id_to_string),
    ),
    #(
      "submitted",
      json.array(round.submitted, string_encoder(player_id_to_string)),
    ),
  ])
}

pub type FinishedRound {
  FinishedRound(
    words: List(String),
    leading_player_id: PlayerId,
    player_scores: List(PlayerScore),
  )
}

fn finished_round_decoder() -> decode.Decoder(FinishedRound) {
  use words <- decode.field("words", decode.list(decode.string))
  use leading_player_id <- decode.field(
    "leading_player_id",
    string_decoder(PlayerId),
  )
  use player_scores <- decode.field(
    "player_scores",
    decode.list(player_score_decoder()),
  )
  decode.success(FinishedRound(words:, leading_player_id:, player_scores:))
}

fn encode_finished_round(finished_round: FinishedRound) -> json.Json {
  json.object([
    #("words", json.array(finished_round.words, json.string)),
    #(
      "leading_player_id",
      finished_round.leading_player_id |> string_encoder(player_id_to_string),
    ),
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
    room_code: RoomCode,
    players: List(Player),
    // All of the words that can be chosen from to create a round.
    word_list: List(String),
    round: Option(Round),
    finished_rounds: List(FinishedRound),
    scoring_method: ScoringMethod,
  )
}

fn room_decoder() -> decode.Decoder(Room) {
  use room_code <- decode.field("room_code", string_decoder(RoomCode))
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
    #("room_code", room.room_code |> string_encoder(room_code_to_string)),
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

fn string_decoder(constructor: fn(String) -> a) -> decode.Decoder(a) {
  decode.then(decode.string, fn(str) { decode.success(constructor(str)) })
}

pub fn player_name_to_string(player_name: PlayerName) -> String {
  let PlayerName(name) = player_name
  name
}

pub fn player_id_to_string(player_id: PlayerId) -> String {
  let PlayerId(id) = player_id
  id
}

fn string_encoder(to_string: fn(a) -> String) -> fn(a) -> json.Json {
  fn(str) { to_string(str) |> json.string }
}

pub fn room_code_to_string(room_code: RoomCode) -> String {
  let RoomCode(code) = room_code
  code
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
