require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const Habit = require("./habit");
const User = require("./user");


const app = express();

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

app.get("/", (req, res) => {
  res.send("Server is working");
});app.post("/signup"

, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    name,
    email,
    password: hashedPassword
  });

  await user.save();

  res.json({
    message: "Signup successful",
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    }
  });
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Wrong password"
      });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      message: err.message
    });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "No account found with this email" });
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  user.resetCode = resetCode;
  user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

  await user.save();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Habit Tracker Password Reset Code",
    text: `Your password reset code is ${resetCode}. This code expires in 10 minutes.`
  });

  res.json({ message: "Reset code sent to your email" });
});

app.put("/reset-password", async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({ message: "Email, code, and new password are required" });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "No account found with this email" });
  }

  if (user.resetCode !== resetCode) {
    return res.status(400).json({ message: "Invalid reset code" });
  }

  if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
    return res.status(400).json({ message: "Reset code expired" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  user.password = hashedPassword;
  user.resetCode = undefined;
  user.resetCodeExpires = undefined;

  await user.save();

  res.json({ message: "Password updated successfully. Please login." });
});

app.post("/habits", async (req, res) => {
  const habit = new Habit({
    name: req.body.name,
    category: req.body.category || "General",
    userId: req.body.userId
  });

  await habit.save();
  res.json(habit);
});

app.get("/habits", async (req, res) => {
  const habits = await Habit.find({ userId: req.query.userId });
  res.json(habits);
});

app.get("/delete/:id", async (req, res) => {
  await Habit.findByIdAndDelete(req.params.id);
  res.send("Habit deleted");
});

app.get("/complete/:id", async (req, res) => {
  const habit = await Habit.findById(req.params.id);

  if (!habit) {
    return res.status(404).send("Habit not found");
  }

  const todayDate = new Date();
  const today = todayDate.toISOString().split("T")[0];

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  if (!habit.completionDates) {
    habit.completionDates = [];
  }

  if (habit.completionDates.includes(today)) {
    return res.send("Already completed today");
  }

  if (habit.completionDates.includes(yesterday)) {
    habit.streak += 1;
  } else {
    habit.streak = 1;
  }

  habit.progress = 1;
  habit.lastCompleted = todayDate;
  habit.completionDates.push(today);

  await habit.save();

  res.json(habit);
});

app.put("/edit/:id", async (req, res) => {
  const updatedHabit = await Habit.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      category: req.body.category
    },
    { new: true }
  );

  res.json(updatedHabit);
});

app.listen(5000, () => console.log("Server running on port 5000"));