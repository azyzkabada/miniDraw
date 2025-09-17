cmake_minimum_required(VERSION 3.20)
project(figma_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_executable(figma_engine src/engine.cpp)
target_include_directories(figma_engine PRIVATE include)

target_compile_options(figma_engine PRIVATE -Wall -Wextra -Wpedantic)

set_target_properties(figma_engine PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../public/engine"
  OUTPUT_NAME "engine"
  SUFFIX ".mjs"
)

target_link_options(figma_engine PRIVATE
  --bind
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=web,worker
  -sALLOW_MEMORY_GROWTH=1
  -sOFFSCREENCANVAS_SUPPORT=1
  -sASSERTIONS=1
)
