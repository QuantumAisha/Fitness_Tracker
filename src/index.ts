// Import necessary libraries
import { v4 as uuidv4 } from "uuid";
import { Server, StableBTreeMap, Principal } from "azle";
import express from "express";

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

// Define the express server
export default Server(() => {
  const app = express();
  app.use(express.json());

  // Endpoint for creating a new user
  app.post("/users", (req, res) => {
    if (!req.body.name || typeof req.body.name !== "string" || !req.body.email || typeof req.body.email !== "string") {
      res.status(400).json({
        error: "Invalid input: Ensure 'name' and 'email' are provided and are strings.",
      });
      return;
    }

    // Validate the email format to ensure it's correct
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      res.status(400).json({
        error: "Invalid input: Ensure 'email' is a valid email address.",
      });
      return;
    }

    // Ensure the email is unique
    const existingUser = usersStorage.values().find((user) => user.email === req.body.email);
    if (existingUser) {
      res.status(409).json({
        error: "User with this email already exists.",
      });
      return;
    }

    try {
      const user = new User(req.body.name, req.body.email);
      usersStorage.insert(user.id, user);
      res.status(201).json({
        message: "User created successfully",
        user: user,
      });
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({
        error: "Server error occurred while creating the user.",
      });
    }
  });

  // Endpoint for creating a new activity
  app.post("/activities", (req, res) => {
    if (
      !req.body.userId ||
      typeof req.body.userId !== "string" ||
      !req.body.type ||
      typeof req.body.type !== "string" ||
      !req.body.duration ||
      typeof req.body.duration !== "number" ||
      !req.body.date
    ) {
      res.status(400).json({
        error: "Invalid input: Ensure 'userId', 'type', 'duration', and 'date' are provided and are of the correct types.",
      });
      return;
    }

    // Validate the userId to ensure it exists
    const userOpt = usersStorage.get(req.body.userId);
    if (!userOpt.Some) {
      res.status(404).json({
        error: "User with the given ID does not exist.",
      });
      return;
    }
    
    try {
      const activity = new Activity(req.body.userId, req.body.type, req.body.duration, new Date(req.body.date));
      activitiesStorage.insert(activity.id, activity);

      // Update user points
      const userOpt = usersStorage.get(req.body.userId);
      if (userOpt.Some) {
        const user = userOpt.Some;
        user.points += req.body.duration; // Assuming 1 point per minute of activity
        usersStorage.insert(user.id, user);
      }

      res.status(201).json({
        message: "Activity created successfully",
        activity: activity,
      });
    } catch (error) {
      console.error("Failed to create activity:", error);
      res.status(500).json({
        error: "Server error occurred while creating the activity.",
      });
    }
  });

  // Endpoint for creating a new challenge
  app.post("/challenges", (req, res) => {
    if (
      !req.body.creatorId ||
      typeof req.body.creatorId !== "string" ||
      !req.body.title ||
      typeof req.body.title !== "string" ||
      !req.body.description ||
      typeof req.body.description !== "string"
    ) {
      res.status(400).json({
        error: "Invalid input: Ensure 'creatorId', 'title', and 'description' are provided and are strings.",
      });
      return;
    }

    // Validate the creatorId to ensure it exists(creatorId is the user ID)
    const userOpt = usersStorage.get(req.body.creatorId);
    if (!userOpt.Some) {
      res.status(404).json({
        error: "User with the given ID does not exist.",
      });
      return;
    }

    try {
      const challenge = new Challenge(req.body.creatorId, req.body.title, req.body.description);
      challengesStorage.insert(challenge.id, challenge);
      res.status(201).json({
        message: "Challenge created successfully",
        challenge: challenge,
      });
    } catch (error) {
      console.error("Failed to create challenge:", error);
      res.status(500).json({
        error: "Server error occurred while creating the challenge.",
      });
    }
  });

  // Endpoint for joining a challenge
  app.post("/challenges/:challengeId/join", (req, res) => {
    if (!req.body.userId || typeof req.body.userId !== "string") {
      res.status(400).json({
        error: "Invalid input: Ensure 'userId' is provided and is a string.",
      });
      return;
    }

    // Valiadate the challengeId to ensure it exists
    const challengeOpt1 = challengesStorage.get(req.params.challengeId);
    if (!challengeOpt1.Some) {
      res.status(404).json({
        error: "Challenge not found.",
      });
      return;
    }

    // Validate the userId to ensure it exists
    const userOpt = usersStorage.get(req.body.userId);
    if (!userOpt.Some) {
      res.status(404).json({
        error: "User with the given ID does not exist.",
      });
      return;
    }

    const challengeOpt = challengesStorage.get(req.params.challengeId);
    if (!challengeOpt.Some) {
      res.status(404).json({
        error: "Challenge not found.",
      });
      return;
    }

    const challenge = challengeOpt.Some;
    challenge.participants.push(req.body.userId);
    challengesStorage.insert(challenge.id, challenge);

    res.status(200).json({
      message: "Joined challenge successfully",
      challenge: challenge,
    });
  });

  // Endpoint for following a user
  app.post("/follows", (req, res) => {
    if (
      !req.body.followerId ||
      typeof req.body.followerId !== "string" ||
      !req.body.followingId ||
      typeof req.body.followingId !== "string"
    ) {
      res.status(400).json({
        error: "Invalid input: Ensure 'followerId' and 'followingId' are provided and are strings.",
      });
      return;
    }

    // Validate the followerId to ensure it exists(followerId is the user ID)
    const userOpt = usersStorage.get(req.body.followerId);
    if (!userOpt.Some) {
      res.status(404).json({
        error: "User with the given ID does not exist.",
      });
      return;
    }

    // Validate the ids to make sure the user doesn't follow themselves
    if (req.body.followerId === req.body.followingId) {
      res.status(400).json({
        error: "Invalid input: User cannot follow themselves.",
      });
      return;
    }

    // Validate the followingId to ensure it exists(followingId is the user ID)
    const userOpt2 = usersStorage.get(req.body.followingId);
    if (!userOpt2.Some) {
      res.status(404).json({
        error: "User with the given ID does not exist.",
      });
      return;
    }
    
    try {
      const follow = new Follow(req.body.followerId, req.body.followingId);
      followsStorage.insert(follow.id, follow);
      res.status(201).json({
        message: "Followed user successfully",
        follow: follow,
      });
    } catch (error) {
      console.error("Failed to follow user:", error);
      res.status(500).json({
        error: "Server error occurred while following the user.",
      });
    }
  });

  // Endpoint for retrieving all users
  app.get("/users", (req, res) => {
    try {
      const users = usersStorage.values();
      res.status(200).json({
        message: "Users retrieved successfully",
        users: users,
      });
    } catch (error) {
      console.error("Failed to retrieve users:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving users.",
      });
    }
  });

  // Endpoint for retrieving all activities
  app.get("/activities", (req, res) => {
    try {
      const activities = activitiesStorage.values();
      res.status(200).json({
        message: "Activities retrieved successfully",
        activities: activities,
      });
    } catch (error) {
      console.error("Failed to retrieve activities:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving activities.",
      });
    }
  });

  // Endpoint for retrieving activities by user ID
  app.get("/activities/:userId", (req, res) => {
    if (!req.params.userId || typeof req.params.userId !== "string") {
      res.status(400).json({
        error: "Invalid input: Ensure 'userId' is provided as a string.",
      });
      return;
    }

    try {
      const userActivities = activitiesStorage.values().filter((activity) => activity.userId === req.params.userId);
      res.status(200).json({
        message: "Activities retrieved successfully",
        activities: userActivities,
      });
    } catch (error) {
      console.error("Failed to retrieve activities:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving activities.",
      });
    }
  });

  // Endpoint for retrieving all challenges
  app.get("/challenges", (req, res) => {
    try {
      const challenges = challengesStorage.values();
      res.status(200).json({
        message: "Challenges retrieved successfully",
        challenges: challenges,
      });
    } catch (error) {
      console.error("Failed to retrieve challenges:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving challenges.",
      });
    }
  });

  // Endpoint for retrieving all followers for a user
  app.get("/follows/:userId", (req, res) => {
    if (!req.params.userId || typeof req.params.userId !== "string") {
      res.status(400).json({
        error: "Invalid input: Ensure 'userId' is provided as a string.",
      });
      return;
    }

    try {
      const followers = followsStorage.values().filter((follow) => follow.followingId === req.params.userId);
      res.status(200).json({
        message: "Followers retrieved successfully",
        followers: followers,
      });
    } catch (error) {
      console.error("Failed to retrieve followers:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving followers.",
      });
    }
  });

  // Endpoint for retrieving the leaderboard
  app.get("/leaderboard", (req, res) => {
    try {
      const users = usersStorage.values();
      const leaderboard = users.sort((a, b) => b.points - a.points).slice(0, 10); // Top 10 users
      res.status(200).json({
        message: "Leaderboard retrieved successfully",
        leaderboard: leaderboard,
      });
    } catch (error) {
      console.error("Failed to retrieve leaderboard:", error);
      res.status(500).json({
        error: "Server error occurred while retrieving leaderboard.",
      });
    }
  });

  // Start the server
  return app.listen();
});
