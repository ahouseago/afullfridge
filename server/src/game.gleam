import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/int
import gleam/io
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import internal/scoring
import prng/random
import prng/seed
import random_word
import shared.{
  type Id, type Player, type Room, AddWord, ListWords, Player, RemovePlayer,
  Room, Round, StartRound, SubmitOrderedWords, id_from_string, id_to_string,
}

pub fn start() -> Result(Subject(Msg), actor.StartError) {
  actor.start(initial_state(), update)
}

type State {
  State(
    next_player_id: Int,
    room_code_generator: RoomCodeGenerator,
    players: Dict(Id(Player), PlayerConnection),
    rooms: Dict(Id(Room), RoomState),
    connections: Dict(Id(Player), fn(shared.WebsocketResponse) -> Nil),
  )
}

fn initial_state() -> State {
  State(
    next_player_id: 0,
    room_code_generator: RoomCodeGenerator(
      generator: random.int(65, 90),
      seed: seed.random(),
    ),
    players: dict.new(),
    rooms: dict.new(),
    connections: dict.new(),
  )
}

type PlayerConnection {
  PlayerConnection(id: Id(Player), room_code: Id(Room), name: String)
}

pub type RoomState {
  RoomState(room: shared.Room, round_state: Option(InProgressRound))
}

pub type InProgressRound {
  InProgressRound(
    words: List(String),
    leading_player_id: Id(Player),
    submitted_word_lists: List(shared.PlayerWithOrderedPreferences),
  )
}

type RoomCodeGenerator {
  RoomCodeGenerator(generator: random.Generator(Int), seed: seed.Seed)
}

// These messages are the ways to communicate with the game state actor.
pub type Msg {
  NewConnection(
    player_id: Id(Player),
    send_message: fn(shared.WebsocketResponse) -> Nil,
    player_name: String,
  )
  Disconnect(Id(Player))
  ProcessWebsocketRequest(from: Id(Player), message: shared.WebsocketRequest)

  ValidateName(
    reply_with: Subject(Result(Nil, String)),
    player_id: Id(Player),
    player_name: String,
  )
  GetRoom(reply_with: Subject(Result(Room, Nil)), room_code: Id(Room))
  CreateRoom(reply_with: Subject(Result(#(Id(Room), Id(Player)), Nil)))
  AddPlayerToRoom(
    reply_with: Subject(Result(Id(Player), Nil)),
    room_code: Id(Room),
  )
}

fn update(msg: Msg, state: State) -> actor.Next(Msg, State) {
  case msg {
    NewConnection(player_id, send_fn, player_name) -> {
      case dict.get(state.players, player_id) {
        Ok(PlayerConnection(id, room_code, "")) -> {
          io.println(
            "player "
            <> id_to_string(id)
            <> " set up websocket connection in room "
            <> id_to_string(room_code)
            <> ".",
          )
          let connections = dict.insert(state.connections, id, send_fn)
          let players =
            dict.insert(
              state.players,
              id,
              PlayerConnection(id, room_code, player_name),
            )
          let rooms = case dict.get(state.rooms, room_code) {
            Ok(room_state) -> {
              let room =
                Room(..room_state.room, players: [
                  Player(id: id, name: player_name, connected: True),
                  ..room_state.room.players
                ])
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              let room_state = RoomState(..room_state, room: room)
              dict.insert(state.rooms, room_code, room_state)
            }
            Error(_) -> state.rooms
          }
          actor.continue(
            State(
              ..state,
              players: players,
              rooms: rooms,
              connections: connections,
            ),
          )
        }
        Ok(PlayerConnection(id:, room_code:, ..)) -> {
          let connections = dict.insert(state.connections, id, send_fn)
          let rooms = case dict.get(state.rooms, room_code) {
            Ok(room_state) -> {
              let room =
                Room(
                  ..room_state.room,
                  players: list.map(room_state.room.players, fn(player) {
                    Player(
                      ..player,
                      connected: player.id == player.id || player.connected,
                    )
                  }),
                )
              broadcast_message(
                state.connections,
                to: room.players,
                message: shared.PlayersInRoom(room.players),
              )
              send_fn(shared.InitialRoomState(room))
              let room_state = RoomState(..room_state, room: room)
              dict.insert(state.rooms, room_code, room_state)
            }
            Error(_) -> state.rooms
          }
          actor.continue(State(..state, rooms: rooms, connections: connections))
        }
        Error(Nil) -> {
          io.println("found error when getting player for new connection")
          actor.continue(state)
        }
      }
    }
    Disconnect(player_id) -> {
      let rooms =
        dict.get(state.players, player_id)
        |> result.map(fn(player) { player.room_code })
        |> result.try(fn(room_code) { dict.get(state.rooms, room_code) })
        |> result.try(fn(room_state) {
          let room =
            Room(
              ..room_state.room,
              players: list.map(room_state.room.players, fn(player) {
                Player(
                  ..player,
                  connected: player.id != player_id && player.connected,
                )
              }),
            )
          broadcast_message(
            state.connections,
            room.players,
            shared.PlayersInRoom(room.players),
          )
          let room_state = RoomState(..room_state, room: room)
          Ok(dict.insert(state.rooms, room_state.room.room_code, room_state))
        })
        |> result.unwrap(state.rooms)
      actor.continue(
        State(
          ..state,
          rooms: rooms,
          connections: dict.delete(state.connections, player_id),
        ),
      )
    }
    ProcessWebsocketRequest(from, request) -> {
      actor.continue(
        handle_websocket_request(state, from, request)
        |> result.unwrap(state),
      )
    }
    CreateRoom(subj) -> {
      let #(state, player_id) = get_next_player_id(state)
      let #(state, room_code) = generate_room_code(state)
      let player =
        PlayerConnection(id: player_id, room_code: room_code, name: "")
      let room =
        Room(
          room_code: room_code,
          players: [],
          word_list: [],
          round: None,
          finished_rounds: [],
          scoring_method: shared.Smart,
        )
      actor.send(subj, Ok(#(room_code, player_id)))
      let room_state = RoomState(room: room, round_state: None)
      actor.continue(
        State(
          ..state,
          players: dict.insert(state.players, player_id, player),
          rooms: dict.insert(state.rooms, room_code, room_state),
        ),
      )
    }
    ValidateName(subj, player_id, player_name) -> {
      let valid = {
        use player <- result.then(
          dict.get(state.players, player_id)
          |> result.replace_error("Player not found"),
        )
        use room_state <- result.then(
          dict.get(state.rooms, player.room_code)
          |> result.replace_error("Player not in room"),
        )
        case
          list.any(room_state.room.players, fn(player) {
            names_match(player.name, player_name) && player.id != player_id
          })
        {
          True -> Error("Name already taken")
          False -> Ok(Nil)
        }
      }
      actor.send(subj, valid)
      actor.continue(state)
    }
    GetRoom(subj, room_code) -> {
      actor.send(
        subj,
        dict.get(state.rooms, room_code)
          |> result.map(fn(room_state) { room_state.room }),
      )
      actor.continue(state)
    }
    AddPlayerToRoom(subj, room_code) -> {
      result.map(dict.get(state.rooms, room_code), fn(room) {
        let #(state, player_id) = get_next_player_id(state)
        let player_connection =
          PlayerConnection(id: player_id, room_code: room_code, name: "")
        actor.send(subj, Ok(player_id))
        actor.continue(
          State(
            ..state,
            players: dict.insert(state.players, player_id, player_connection),
            rooms: dict.insert(state.rooms, room_code, room),
          ),
        )
      })
      |> result.unwrap({
        actor.send(subj, Error(Nil))
        actor.continue(state)
      })
    }
  }
}

fn get_next_player_id(state: State) -> #(State, Id(Player)) {
  let id = state.next_player_id
  let player_id = int.to_string(id) |> id_from_string
  #(State(..state, next_player_id: id + 1), player_id)
}

fn generate_room_code(state: State) {
  let #(utf_points, new_seed) =
    list.range(1, 4)
    |> list.fold(#([], state.room_code_generator.seed), fn(rolls, _) {
      let #(roll, new_seed) =
        random.step(state.room_code_generator.generator, rolls.1)
      let assert Ok(utf_point) = string.utf_codepoint(roll)
      #([utf_point, ..rolls.0], new_seed)
    })

  #(
    State(
      ..state,
      room_code_generator: RoomCodeGenerator(
        ..state.room_code_generator,
        seed: new_seed,
      ),
    ),
    id_from_string(string.from_utf_codepoints(utf_points)),
  )
}

fn broadcast_message(
  connections: Dict(Id(Player), fn(shared.WebsocketResponse) -> Nil),
  to players: List(Player),
  message msg: shared.WebsocketResponse,
) {
  use player <- list.each(players)
  use send_fn <- result.map(dict.get(connections, player.id))
  send_fn(msg)
}

fn send_message(
  connections: Dict(Id(Player), fn(shared.WebsocketResponse) -> Nil),
  to player_id: Id(Player),
  message msg: shared.WebsocketResponse,
) {
  let _ =
    result.map(dict.get(connections, player_id), fn(send_fn) { send_fn(msg) })
  Nil
}

fn handle_websocket_request(
  state: State,
  from: Id(Player),
  request: shared.WebsocketRequest,
) -> Result(State, Nil) {
  use player <- result.map(dict.get(state.players, from))
  let room_code = player.room_code
  case request {
    AddWord(word) -> {
      let new_state = add_word_to_room(state, room_code, word)
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    shared.AddRandomWord -> {
      let new_state = add_word_to_room(state, room_code, random_word.new())
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    shared.RemoveWord(word) -> {
      let new_state = remove_word_from_room(state, room_code, word)
      let _ = result.try(new_state, list_words(_, room_code))
      result.unwrap(new_state, state)
    }
    ListWords -> {
      let _ = list_words(state, room_code)
      state
    }
    StartRound -> {
      let new_state =
        result.map(dict.get(state.rooms, room_code), fn(room_state) {
          let room_state = start_new_round(state, room_state)
          State(..state, rooms: dict.insert(state.rooms, room_code, room_state))
        })
      result.unwrap(new_state, state)
    }
    SubmitOrderedWords(ordered_words) -> {
      submit_words(state, player, ordered_words)
      |> result.unwrap(None)
      |> option.unwrap(state)
    }
    RemovePlayer(player_id) -> {
      result.unwrap(remove_player_from_room(state, player_id, from), state)
    }
  }
}

fn get_next_leading_player(room_state: RoomState) -> Id(Player) {
  let players_count = list.length(room_state.room.players)
  // Reverse the list to start from the first player to join.
  let index =
    players_count - list.length(room_state.room.finished_rounds) % players_count

  let assert Ok(player) =
    room_state.room.players
    |> list.take(index)
    |> list.reverse
    |> list.first

  player.id
}

fn start_new_round(state: State, room_state: RoomState) -> RoomState {
  // Starting a round means:
  // - picking 5 words randomly
  let words = room_state.room.word_list |> list.shuffle |> list.take(5)
  // - picking a player to start
  let leading_player_id = get_next_leading_player(room_state)

  let in_progress_round = InProgressRound(words, leading_player_id, [])
  let round =
    shared.Round(
      in_progress_round.words,
      in_progress_round.leading_player_id,
      [],
    )

  let room = Room(..room_state.room, round: Some(round))

  // - sending round info to clients
  broadcast_message(state.connections, room.players, shared.RoundInfo(round))

  RoomState(round_state: Some(in_progress_round), room: room)
}

fn list_words(state: State, room_code: Id(Room)) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  broadcast_message(
    state.connections,
    room_state.room.players,
    shared.WordList(room_state.room.word_list),
  )
}

fn add_word_to_room(state: State, room_code: Id(Room), word: String) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  // Remove duplicates
  let word_list = room_state.room.word_list |> list.filter(fn(w) { w != word })
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      RoomState(
        ..room_state,
        room: Room(..room_state.room, word_list: [word, ..word_list]),
      ),
    ),
  )
}

fn remove_word_from_room(state: State, room_code: Id(Room), word: String) {
  use room_state <- result.map(dict.get(state.rooms, room_code))
  // Remove word from list
  let word_list = room_state.room.word_list |> list.filter(fn(w) { w != word })
  State(
    ..state,
    rooms: dict.insert(
      state.rooms,
      room_code,
      RoomState(
        ..room_state,
        room: Room(..room_state.room, word_list: word_list),
      ),
    ),
  )
}

fn submit_words(
  state: State,
  player: PlayerConnection,
  ordered_words: List(String),
) {
  use room_state <- result.map(dict.get(state.rooms, player.room_code))
  use round_state <- option.then(room_state.round_state)
  use round <- option.map(room_state.room.round)

  let lists_equal =
    list.sort(ordered_words, string.compare)
    == list.sort(round_state.words, string.compare)

  let #(round_state, round) = case lists_equal {
    False -> {
      send_message(
        state.connections,
        player.id,
        shared.ServerError("submitted words don't match the word list"),
      )
      #(round_state, round)
    }
    True -> {
      #(
        InProgressRound(..round_state, submitted_word_lists: [
          #(player.id, ordered_words),
          ..list.filter(round_state.submitted_word_lists, fn(words) {
            words.0 != player.id
          })
        ]),
        Round(..round, submitted: [player.id, ..round.submitted]),
      )
    }
  }

  // Score round and move to the next round if everyone has submitted.
  let room_state = case
    list.length(round_state.submitted_word_lists)
    == list.length(room_state.room.players)
  {
    False -> {
      // Update round info so players know who they're waiting for
      broadcast_message(
        state.connections,
        to: room_state.room.players,
        message: shared.RoundInfo(round),
      )
      RoomState(
        round_state: Some(round_state),
        room: Room(..room_state.room, round: Some(round)),
      )
    }
    True -> {
      RoomState(
        ..room_state,
        room: Room(..room_state.room, finished_rounds: [
          finish_round(state, room_state, round_state),
          ..room_state.room.finished_rounds
        ]),
      )
      |> start_new_round(state, _)
    }
  }

  State(..state, rooms: dict.insert(state.rooms, player.room_code, room_state))
}

fn finish_round(
  state: State,
  room_state: RoomState,
  round: InProgressRound,
) -> shared.FinishedRound {
  let finished_round =
    shared.FinishedRound(
      words: round.words,
      leading_player_id: round.leading_player_id,
      player_scores: get_player_scores(
        room_state.room.players,
        round,
        score_round(room_state.room.scoring_method, round),
      ),
    )

  broadcast_message(
    state.connections,
    to: room_state.room.players,
    message: shared.RoundResult(finished_round),
  )

  finished_round
}

fn score_round(
  scoring_method: shared.ScoringMethod,
  round: InProgressRound,
) -> List(#(Id(Player), Int)) {
  let correct_word_list =
    list.filter(round.submitted_word_lists, fn(word_list) {
      word_list.0 == round.leading_player_id
    })
    |> list.map(fn(player_with_preferences) { player_with_preferences.1 })
    |> list.first

  case scoring_method, correct_word_list {
    shared.ExactMatch, Ok(correct_word_list) ->
      scoring.exact_match
      |> score_players(round, correct_word_list)
    shared.EqualPositions, Ok(correct_word_list) ->
      scoring.equal_position
      |> score_players(round, correct_word_list)
    shared.Smart, Ok(correct_word_list) ->
      scoring.smart
      |> score_players(round, correct_word_list)
    _, Error(_) -> no_score(round)
  }
}

/// This is used when the leading player has left before submitting a word list:
/// nobody can score.
fn no_score(round: InProgressRound) -> List(#(Id(Player), Int)) {
  list.fold(round.submitted_word_lists, [], fn(scores, word_list) {
    [#(word_list.0, 0), ..scores]
  })
}

type CorrectWordList =
  List(String)

type GuessedWordList =
  List(String)

/// This awards 0 points to the leading player and gives all other players the
/// score determined by the scoring callback.
fn score_players(round: InProgressRound, correct_word_list: List(String)) {
  fn(score_fn: fn(CorrectWordList, GuessedWordList) -> Int) {
    list.fold(
      round.submitted_word_lists,
      [],
      fn(
        scores: List(#(Id(Player), Int)),
        word_list: #(Id(Player), List(String)),
      ) {
        let score = case word_list.0 == round.leading_player_id {
          True -> #(word_list.0, 0)
          False -> #(word_list.0, score_fn(correct_word_list, word_list.1))
        }
        [score, ..scores]
      },
    )
  }
}

fn get_player_scores(
  players: List(shared.Player),
  round: InProgressRound,
  scores: List(#(Id(Player), Int)),
) -> List(shared.PlayerScore) {
  let scores =
    list.fold(scores, dict.new(), fn(scores, score) {
      dict.insert(scores, score.0, score.1)
    })
  let player_map =
    list.fold(players, dict.new(), fn(player_names, player) {
      dict.insert(player_names, player.id, player)
    })

  list.map(round.submitted_word_lists, fn(word_list) {
    let player_name =
      dict.get(player_map, word_list.0)
      |> result.unwrap(Player(id_from_string(""), "Unknown", False))
    let score = dict.get(scores, word_list.0) |> result.unwrap(0)
    shared.PlayerScore(player_name, word_list.1, score)
  })
}

/// Checks whether player names match, ignoring case differences.
fn names_match(name_a: String, name_b: String) -> Bool {
  string.lowercase(name_a) == string.lowercase(name_b)
}

fn remove_player_from_room(state: State, player_id, requesting_player_id) {
  // Validate that the requesting player is in the same room
  let requesting_player = dict.get(state.players, requesting_player_id)
  let player = dict.get(state.players, player_id)
  case player, requesting_player {
    Ok(player), Ok(requester) if player.room_code == requester.room_code ->
      Ok(player)
    _, _ -> Error(Nil)
  }
  |> result.try(fn(player) {
    use room_state <- result.map(dict.get(state.rooms, player.room_code))
    let room =
      Room(
        ..room_state.room,
        players: list.filter(room_state.room.players, fn(p) {
          p.id != player_id
        }),
      )
    send_message(state.connections, to: player_id, message: shared.Kicked)
    broadcast_message(
      state.connections,
      to: room.players,
      message: shared.PlayersInRoom(room.players),
    )
    State(
      ..state,
      rooms: dict.insert(
        state.rooms,
        room.room_code,
        RoomState(..room_state, room:),
      ),
    )
  })
}
