;; equality comparisons, can be inverted
(binary_expression "==" @comparison_equal)
(binary_expression "!=" @comparison_not_equal)

;; relative comparisons
(binary_expression ">" @comparison_greater_than)
(binary_expression "<" @comparison_less_than)
(binary_expression "<=" @comparison_less_than_equal)
(binary_expression ">=" @comparison_greater_than_equal)

(boolean) @boolean

(unary_expression ["!" "~" "+" "-"] @unary_operator)

;; value updates, can be inverted
(update_expression "++" @update_increment)
(update_expression "--" @update_decrement)

;; capture math expressions
;; minus is safe
(binary_expression "-" @addition_subtract)
;; not smart enough yet to know the difference between concatenation and math
;; (binary_expression "+" @addition_add)

;; capture literals for possible replacement
(int) @int_value
;; best effort at finding strings that are worth mutating
;; things like constants and logging statements are
(binary_expression (string_literal)? @string_literal ["==" "!=" ">" "<" ">=" "<="]  (string_literal)? @string_literal)
(method_invocation (string_literal)? @string_literal)
(method_invocation (string_literal)? @string_literal arguments: (argument_list(string_literal) @string_literal))

;; capture dml expressions for removal
((dml_expression (dml_type))";") @dml_expression

;; change return value statements into return null
;; (return_statement (null_literal)) @ignore
(return_statement (_)) @return_with_value

(continue_statement) @continue
(break_statement) @break