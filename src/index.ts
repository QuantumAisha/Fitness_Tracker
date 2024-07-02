// Import necessary libraries
import { v4 as uuidv4 } from "uuid";
import { Server, StableBTreeMap, Principal } from "azle";
import express from "express";
import Joi from "joi";

// Define the User class to represent users
class User {
  id: string;
  name: string;
  email: string;
  points: number;
  createdAt: Date;

  constructor(name: string, email: string) {
    this.id = uuidv4();
    this.name = name;
    this.email = email;
    this.points = 0; // Initialize points to 0
    this.createdAt = new Date();
  }
}

// Define the Activity class to represent fitness activities
class Activity {
  id: string;
  userId: string;
  type: string;
  duration: number; // duration in minutes
  date: Date;
  createdAt: Date;

  constructor(userId: string, type: string, duration: number, date: Date) {
    this.id = uuidv4();
    this.userId = userId;
    this.type = type;
    this.duration = duration;
    this.date = date;
    this.createdAt = new Date();
  }
}

// Define the Challenge class to represent fitness challenges
class Challenge {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  participants: string[];
  createdAt: Date;

  constructor(creatorId: string, title: string, description: string) {
    this.id = uuidv4();
    this.creatorId = creatorId;
    this.title = title;
    this.description = description;
    this.participants = [];
    this.createdAt = new Date();
  }
}

// Define the Follow class to represent user follow relationships
class Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;

  constructor(followerId: string, followingId: string) {
    this.id = uuidv4();
    this.followerId = followerId;
    this.followingId = followingId;
    this.createdAt = new Date();
  }
}

// Initialize stable maps for storing fitness tracker data
const usersStorage = StableBTreeMap<string, User>(0);
const activitiesStorage = StableBTreeMap<string, Activity>(1);
const challengesStorage = StableBTreeMap<string, Challenge>(2);
const followsStorage = StableBTreeMap<string, Follow>(3);

// Define validation schemas using Joi
const userSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required()
});

const activitySchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().required(),
  duration: Joi.number().integer().positive().required(),
  date: Joi.date().required()
});

const challengeSchema = Joi.object({
  creatorId: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required()
});

const followSchema = Joi.object({
  followerId: Joi.string().required(),
  followingId: Joi.string().required()
});

// Middleware for error handling
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Server error occurred'
  });
};

// Define the express server
export default Server(() => {
  const app = express();
  app.use(express.json());

  // Endpoint for creating a new user
  app.post("/users", (req, res) => {
    const { error, value } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existingUser = usersStorage.values().find((user) => user.email === value.email);
    if (existingUser) return res.status(409).json({ error: "User with this email already exists." });

    try {
      const user = new User(value.name, value.email);
      usersStorage.insert(user.id, user);
      res.status(201).json({ message: "User created successfully", user: user });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for updating user details
  app.put("/users/:id", (req, res) => {
    const { error, value } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userOpt = usersStorage.get(req.params.id);
    if (!userOpt.Some) return res.status(404).json({ error: "User not found." });

    try {
      const user = userOpt.Some;
      user.name = value.name;
      user.email = value.email;
      usersStorage.insert(user.id, user);
      res.status(200).json({ message: "User updated successfully", user: user });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for deleting a user
  app.delete("/users/:id", (req, res) => {
    const userOpt = usersStorage.get(req.params.id);
    if (!userOpt.Some) return res.status(404).json({ error: "User not found." });

    try {
      usersStorage.remove(req.params.id);
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for creating a new activity
  app.post("/activities", (req, res) => {
    const { error, value } = activitySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userOpt = usersStorage.get(value.userId);
    if (!userOpt.Some) return res.status(404).json({ error: "User not found." });

    try {
      const activity = new Activity(value.userId, value.type, value.duration, new Date(value.date));
      activitiesStorage.insert(activity.id, activity);

      const user = userOpt.Some;
      user.points += value.duration; // Assuming 1 point per minute of activity
      usersStorage.insert(user.id, user);

      res.status(201).json({ message: "Activity created successfully", activity: activity });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for deleting an activity
  app.delete("/activities/:id", (req, res) => {
    const activityOpt = activitiesStorage.get(req.params.id);
    if (!activityOpt.Some) return res.status(404).json({ error: "Activity not found." });

    try {
      activitiesStorage.remove(req.params.id);
      res.status(200).json({ message: "Activity deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for creating a new challenge
  app.post("/challenges", (req, res) => {
    const { error, value } = challengeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userOpt = usersStorage.get(value.creatorId);
    if (!userOpt.Some) return res.status(404).json({ error: "User not found." });

    try {
      const challenge = new Challenge(value.creatorId, value.title, value.description);
      challengesStorage.insert(challenge.id, challenge);
      res.status(201).json({ message: "Challenge created successfully", challenge: challenge });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for deleting a challenge
  app.delete("/challenges/:id", (req, res) => {
    const challengeOpt = challengesStorage.get(req.params.id);
    if (!challengeOpt.Some) return res.status(404).json({ error: "Challenge not found." });

    try {
      challengesStorage.remove(req.params.id);
      res.status(200).json({ message: "Challenge deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for joining a challenge
  app.post("/challenges/:challengeId/join", (req, res) => {
    const { error, value } = followSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const challengeOpt = challengesStorage.get(req.params.challengeId);
    if (!challengeOpt.Some) return res.status(404).json({ error: "Challenge not found." });

    const userOpt = usersStorage.get(value.userId);
    if (!userOpt.Some) return res.status(404).json({ error: "User not found." });

    try {
      const challenge = challengeOpt.Some;
      if (challenge.participants.includes(value.userId)) {
        return res.status(409).json({ error: "User already joined the challenge." });
      }
      challenge.participants.push(value.userId);
      challengesStorage.insert(challenge.id, challenge);
      res.status(200).json({ message: "Joined challenge successfully", challenge: challenge });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for following a user
  app.post("/follows", (req, res) => {
    const { error, value } = followSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.followerId === value.followingId) return res.status(400).json({ error: "User cannot follow themselves." });

    const followerOpt = usersStorage.get(value.followerId);
    if (!followerOpt.Some) return res.status(404).json({ error: "Follower not found." });

    const followingOpt = usersStorage.get(value.followingId);
    if (!followingOpt.Some) return res.status(404).json({ error: "Following not found." });

    try {
      const follow = new Follow(value.followerId, value.followingId);
      followsStorage.insert(follow.id, follow);
      res.status(201).json({ message: "Followed user successfully", follow: follow });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for deleting a follow
  app.delete("/follows/:id", (req, res) => {
    const followOpt = followsStorage.get(req.params.id);
    if (!followOpt.Some) return res.status(404).json({ error: "Follow relationship not found." });

    try {
      followsStorage.remove(req.params.id);
      res.status(200).json({ message: "Unfollowed user successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving all users with pagination
  app.get("/users", (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const users = usersStorage.values().slice(offset, offset + limit);
      res.status(200).json({ message: "Users retrieved successfully", users: users });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving all activities with pagination
  app.get("/activities", (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const activities = activitiesStorage.values().slice(offset, offset + limit);
      res.status(200).json({ message: "Activities retrieved successfully", activities: activities });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving activities by user ID with pagination
  app.get("/activities/:userId", (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const userActivities = activitiesStorage.values()
        .filter((activity) => activity.userId === req.params.userId)
        .slice(offset, offset + limit);
      res.status(200).json({ message: "Activities retrieved successfully", activities: userActivities });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving all challenges with pagination
  app.get("/challenges", (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const challenges = challengesStorage.values().slice(offset, offset + limit);
      res.status(200).json({ message: "Challenges retrieved successfully", challenges: challenges });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving all followers for a user
  app.get("/follows/:userId", (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const followers = followsStorage.values()
        .filter((follow) => follow.followingId === req.params.userId)
        .slice(offset, offset + limit);
      res.status(200).json({ message: "Followers retrieved successfully", followers: followers });
    } catch (error) {
      next(error);
    }
  });

  // Endpoint for retrieving the leaderboard with dynamic size and pagination
  app.get("/leaderboard", (req, res) => {
    const { size = 10, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    try {
      const users = usersStorage.values();
      const leaderboard = users.sort((a, b) => b.points - a.points).slice(0, size);
      const paginatedLeaderboard = leaderboard.slice(offset, offset + limit);
      res.status(200).json({ message: "Leaderboard retrieved successfully", leaderboard: paginatedLeaderboard });
    } catch (error) {
      next(error);
    }
  });

  // Middleware for handling errors
  app.use(errorHandler);

  // Start the server
  return app.listen();
});
