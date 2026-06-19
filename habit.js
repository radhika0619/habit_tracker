const mongoose = require("mongoose");

const habitSchema = new mongoose.Schema({
  name: String,
  category: {type: String, default: "General"},
  userId: String,
  streak: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  goal: { type: Number, default: 1 },
  lastCompleted: Date,
  completionDates: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model("Habit", habitSchema);