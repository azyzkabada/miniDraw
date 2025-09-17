#include "engine.hpp"

#include <emscripten/bind.h>
#include <memory>
#include <utility>

#include <array>
#include <cmath>
#include <sstream>
#include <string>

namespace {
std::string makeRectangleId(std::size_t index) {
  std::ostringstream stream;
  stream << "rect-" << index + 1;
  return stream.str();
}

std::string makeRectangleName(std::size_t index) {
  std::ostringstream stream;
  stream << "Rectangle " << index + 1;
  return stream.str();
}

std::string makeStrokeName(std::size_t index) {
  std::ostringstream stream;
  stream << "Trace " << index + 1;
  return stream.str();
}

std::string colorForPointer(int pointer_id) {
  static constexpr std::array<const char*, 6> palette = {
      "#22d3ee", "#f97316", "#a855f7", "#facc15", "#34d399", "#ef4444"};
  const auto normalized = std::abs(pointer_id) % static_cast<int>(palette.size());
  return palette[normalized];
}
}  // namespace

Engine::Engine() : width_(0), height_(0) {}

void Engine::resize(int width, int height) {
  width_ = width;
  height_ = height;

  if (width_ < 0) {
    width_ = 0;
  }
  if (height_ < 0) {
    height_ = 0;
  }
}

Rectangle Engine::makeRectangle(float x, float y, float width, float height, std::string color) const {
  const auto index = rectangles_.size();
  return Rectangle{
      makeRectangleId(index),
      makeRectangleName(index),
      x,
      y,
      width,
      height,
      std::move(color)};
}

Stroke Engine::makeStroke(std::string id,
                          std::string name,
                          float x,
                          float y,
                          float size,
                          std::string color) const {
  Stroke stroke;
  stroke.id = std::move(id);
  stroke.name = std::move(name);
  stroke.color = std::move(color);
  stroke.size = size;
  stroke.points.push_back(StrokePoint{x, y});
  return stroke;
}

Stroke* Engine::findStroke(const std::string& id) {
  auto iterator = strokeIndex_.find(id);
  if (iterator == strokeIndex_.end()) {
    return nullptr;
  }
  const auto index = iterator->second;
  if (index >= strokes_.size()) {
    return nullptr;
  }
  return &strokes_[index];
}

void Engine::execute(emscripten::val command) {
  const auto type = command["type"].as<std::string>();
  if (type == "createRectangle") {
    const auto x = static_cast<float>(command["x"].as<double>());
    const auto y = static_cast<float>(command["y"].as<double>());
    const auto width = static_cast<float>(command["width"].as<double>());
    const auto height = static_cast<float>(command["height"].as<double>());
    const auto color = command["color"].as<std::string>();
    rectangles_.push_back(makeRectangle(x, y, width, height, color));
    return;
  }

  if (type == "startStroke") {
    const auto id = command["id"].as<std::string>();
    const auto x = static_cast<float>(command["x"].as<double>());
    const auto y = static_cast<float>(command["y"].as<double>());
    const auto size = static_cast<float>(command["size"].as<double>());
    const auto color = command["color"].as<std::string>();
    const auto name = makeStrokeName(strokes_.size());
    auto stroke = makeStroke(id, name, x, y, size, color);
    strokeIndex_[stroke.id] = strokes_.size();
    strokes_.push_back(std::move(stroke));
    return;
  }

  if (type == "updateStroke") {
    const auto id = command["id"].as<std::string>();
    const auto x = static_cast<float>(command["x"].as<double>());
    const auto y = static_cast<float>(command["y"].as<double>());
    if (auto* stroke = findStroke(id); stroke != nullptr) {
      stroke->points.push_back(StrokePoint{x, y});
    }
    return;
  }

  if (type == "finishStroke") {
    const auto id = command["id"].as<std::string>();
    strokeIndex_.erase(id);
  }
}

void Engine::updatePresence(int pointer_id, float x, float y) {
  auto iterator = presences_.find(pointer_id);
  if (iterator == presences_.end()) {
    presences_.emplace(pointer_id, Presence{std::to_string(pointer_id), colorForPointer(pointer_id), x, y});
  } else {
    iterator->second.x = x;
    iterator->second.y = y;
  }
}

void Engine::pointerEvent(emscripten::val event) {
  const auto type = event["type"].as<std::string>();
  if (type != "pointerMove") {
    return;
  }

  const auto pointer_id = event["pointerId"].as<int>();
  const auto x = static_cast<float>(event["x"].as<double>());
  const auto y = static_cast<float>(event["y"].as<double>());
  updatePresence(pointer_id, x, y);
}

emscripten::val Engine::tick() const {
  auto shapes = emscripten::val::array();
  std::size_t shape_index = 0;
  for (std::size_t index = 0; index < rectangles_.size(); ++index) {
    const auto& rect = rectangles_[index];
    auto shape = emscripten::val::object();
    shape.set("id", rect.id);
    shape.set("name", rect.name);
    shape.set("kind", std::string("rectangle"));
    shape.set("x", rect.x);
    shape.set("y", rect.y);
    shape.set("width", rect.width);
    shape.set("height", rect.height);
    shape.set("color", rect.color);
    shapes.set(shape_index++, shape);
  }

  for (const auto& stroke : strokes_) {
    auto shape = emscripten::val::object();
    shape.set("id", stroke.id);
    shape.set("name", stroke.name);
    shape.set("kind", std::string("stroke"));
    shape.set("color", stroke.color);
    shape.set("size", stroke.size);

    auto points = emscripten::val::array();
    for (std::size_t index = 0; index < stroke.points.size(); ++index) {
      const auto& point = stroke.points[index];
      auto point_val = emscripten::val::object();
      point_val.set("x", point.x);
      point_val.set("y", point.y);
      points.set(index, point_val);
    }

    shape.set("points", points);
    shapes.set(shape_index++, shape);
  }

  auto presences = emscripten::val::array();
  std::size_t presence_index = 0;
  for (const auto& [id, presence] : presences_) {
    auto presence_val = emscripten::val::object();
    presence_val.set("id", presence.id);
    presence_val.set("color", presence.color);
    presence_val.set("x", presence.x);
    presence_val.set("y", presence.y);
    presences.set(presence_index++, presence_val);
  }

  auto document = emscripten::val::object();
  document.set("id", std::string("doc-native"));
  document.set("name", std::string("Composition native"));
  document.set("shapes", shapes);

  auto state = emscripten::val::object();
  state.set("document", document);
  state.set("presences", presences);
  return state;
}

std::shared_ptr<Engine> createEngine(int width, int height) {
  auto engine = std::make_shared<Engine>();
  engine->resize(width, height);
  return engine;
}

EMSCRIPTEN_BINDINGS(figma_engine_module) {
  emscripten::class_<Engine>("Engine")
      .smart_ptr<std::shared_ptr<Engine>>("Engine")
      .function("resize", &Engine::resize)
      .function("execute", &Engine::execute)
      .function("pointerEvent", &Engine::pointerEvent)
      .function("tick", &Engine::tick);

  emscripten::function("createEngine", &createEngine);
}
