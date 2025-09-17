#pragma once

#include <emscripten/val.h>
#include <string>
#include <unordered_map>
#include <vector>

struct Rectangle {
  std::string id;
  std::string name;
  float x;
  float y;
  float width;
  float height;
  std::string color;
};

struct Presence {
  std::string id;
  std::string color;
  float x;
  float y;
};

struct StrokePoint {
  float x;
  float y;
};

struct Stroke {
  std::string id;
  std::string name;
  std::string color;
  float size;
  std::vector<StrokePoint> points;
};

class Engine {
 public:
  Engine();

  void resize(int width, int height);
  void execute(emscripten::val command);
  void pointerEvent(emscripten::val event);
  emscripten::val tick() const;

 private:
  Rectangle makeRectangle(float x, float y, float width, float height, std::string color) const;
  Stroke makeStroke(std::string id,
                    std::string name,
                    float x,
                    float y,
                    float size,
                    std::string color) const;
  Stroke* findStroke(const std::string& id);
  void updatePresence(int pointerId, float x, float y);

  int width_;
  int height_;
  std::vector<Rectangle> rectangles_;
  std::vector<Stroke> strokes_;
  std::unordered_map<std::string, std::size_t> strokeIndex_;
  std::unordered_map<int, Presence> presences_;
};
