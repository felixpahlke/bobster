# bash completion for bobster
_bobster_completion() {
  local suggestions
  local current_index=$((COMP_CWORD - 1))

  suggestions=$(BOBSTER_COMPLETE_INDEX="$current_index" bobster __complete -- "${COMP_WORDS[@]:1}" 2>/dev/null) || return 0
  [[ -z "$suggestions" ]] && return 0

  local IFS=$'\n'
  COMPREPLY=($(compgen -W "$suggestions" -- "${COMP_WORDS[COMP_CWORD]}"))
}

complete -o default -F _bobster_completion bobster
