function __bobster_complete
    set -l tokens (commandline -opc)
    if test (count $tokens) -gt 0
        set -e tokens[1]
    end

    set -l current_index (math (count $tokens) - 1)
    set -l current_token (commandline -ct)
    if test -z "$current_token"
        set current_index (count $tokens)
        set -a tokens ""
    end

    env BOBSTER_COMPLETE_INDEX=$current_index bobster __complete -- $tokens 2>/dev/null
end

complete -c bobster -f -a "(__bobster_complete)"
