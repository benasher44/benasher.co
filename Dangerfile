# frozen_string_literal: true

rubocop.lint

prose.ignored_words = %w[
  Autodesk
  PlanGrid
  Kotlin
  Obj-C
  JetBrains
  KotlinConf
  globals
  Koans
  Phill
  Farrugia
  interop
  ABI
  timezones
  KotlinMobileBootstrap
  KotlinIos2
  subclassing
  enums
  structs
]
prose.ignore_numbers = true
files_to_check = git.modified_files + git.added_files
prose.lint_files files_to_check
prose.check_spelling files_to_check
