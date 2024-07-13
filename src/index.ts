// Import necessary libraries
import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Server, StableBTreeMap, Principal } from 'azle';

// Define the User class to represent users
class User {
  id: string;
  name: string;
  email: string;
  password: string;
  points: number;
  createdAt: Date;

  constructor(name: string, email: string, password: string) {
    this.id = uuidv4();
    this.name = name;
    this.email = email;
    this.password = bcrypt.hashSync(password, 10);
    this.points = 0;
    this.createdAt = new Date();
  }
}

// Define the Activity class to represent fitness activities
class Activity {
  id: string;
  userId: string;
  type: string;
  duration: number;
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

// Middleware for authentication
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied, no token provided.' });

  try {
    const verified = jwt.verify(token, 'SECRET_KEY');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Express server setup
const app = express();
app.use(express.json());

// Central error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// Endpoint for user registration
app.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const existingUser = [...usersStorage.values()].find(user => user.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }

  try {
    const user = new User(name, email, password);
    usersStorage.insert(user.id, user);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Failed to register user:', error);
    res.status(500).json({ error: 'Server error occurred while registering the user.' });
  }
});

// Endpoint for user login
app.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  const user = [...usersStorage.values()].find(user => user.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign({ id: user.id }, 'SECRET_KEY', { expiresIn: '1h' });
  res.status(200).json({ message: 'Logged in successfully', token });
});

// Endpoint for creating a new activity
app.post('/activities', authenticateToken, (req: Request, res: Response) => {
  const { userId, type, duration, date } = req.body;
  if (!userId || !type || !duration || !date) {
    return res.status(400).json({ error: "Invalid input: Ensure 'userId', 'type', 'duration', and 'date' are provided." });
  }

  const userOpt = usersStorage.get(userId);
  if (!userOpt.Some) {
    return res.status(404).json({ error: 'User with the given ID does not exist.' });
  }

  try {
    const activity = new Activity(userId, type, duration, new Date(date));
    activitiesStorage.insert(activity.id, activity);

    const user = userOpt.Some;
    user.points += duration;
    usersStorage.insert(user.id, user);

    res.status(201).json({ message: 'Activity created successfully', activity });
  } catch (error) {
    console.error('Failed to create activity:', error);
    res.status(500).json({ error: 'Server error occurred while creating the activity.' });
  }
});

// Endpoint for creating a new challenge
app.post('/challenges', authenticateToken, (req: Request, res: Response) => {
  const { creatorId, title, description } = req.body;
  if (!creatorId || !title || !description) {
    return res.status(400).json({ error: "Invalid input: Ensure 'creatorId', 'title', and 'description' are provided." });
  }

  const userOpt = usersStorage.get(creatorId);
  if (!userOpt.Some) {
    return res.status(404).json({ error: 'User with the given ID does not exist.' });
  }

  try {
    const challenge = new Challenge(creatorId, title, description);
    challengesStorage.insert(challenge.id, challenge);
    res.status(201).json({ message: 'Challenge created successfully', challenge });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    res.status(500).json({ error: 'Server error occurred while creating the challenge.' });
  }
});

// Endpoint for joining a challenge
app.post('/challenges/:challengeId/join', authenticateToken, (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: "Invalid input: Ensure 'userId' is provided and is a string." });
  }

  const challengeOpt = challengesStorage.get(challengeId);
  if (!challengeOpt.Some) {
    return res.status(404).json({ error: 'Challenge not found.' });
  }

  const userOpt = usersStorage.get(userId);
  if (!userOpt.Some) {
    return res.status(404).json({ error: 'User with the given ID does not exist.' });
  }

  const challenge = challengeOpt.Some;
  if (challenge.participants.includes(userId)) {
    return res.status(409).json({ error: 'User already joined the challenge.' });
  }

  challenge.participants.push(userId);
  challengesStorage.insert(challenge.id, challenge);

  res.status(200).json({ message: 'Joined challenge successfully', challenge });
});

// Endpoint for following a user
app.post('/follows', authenticateToken, (req: Request, res: Response) => {
  const { followerId, followingId } = req.body;
  if (!followerId || !followingId) {
    return res.status(400).json({ error: "Invalid input: Ensure 'followerId' and 'followingId' are provided." });
  }

  if (followerId === followingId) {
    return res.status(400).json({ error: 'User cannot follow themselves.' });
  }

  const followerOpt = usersStorage.get(followerId);
  if (!followerOpt.Some) {
    return res.status(404).json({ error: 'Follower user not found.' });
  }

  const followingOpt = usersStorage.get(followingId);
  if (!followingOpt.Some) {
    return res.status(404).json({ error: 'Following user not found.' });
  }

  const existingFollow = [...followsStorage.values()].find(follow => follow.followerId === followerId && follow.followingId === followingId);
  if (existingFollow) {
    return res.status(409).json({ error: 'Already following this user.' });
  }

  try {
    const follow = new Follow(followerId, followingId);
    followsStorage.insert(follow.id, follow);
    res.status(201).json({ message: 'Followed user successfully', follow });
  } catch (error) {
    console.error('Failed to follow user:', error);
    res.status(500).json({ error: 'Server error occurred while following the user.' });
  }
});

// Endpoint for listing activities with optional filtering
app.get('/activities', authenticateToken, (req: Request, res: Response) => {
  const { userId, type, startDate, endDate } = req.query;

  let activities = [...activitiesStorage.values()];

  if (userId) {
    activities = activities.filter(activity => activity.userId === userId);
  }
  if (type) {
    activities = activities.filter(activity => activity.type === type);
  }
  if (startDate) {
    const start = new Date(startDate as string);
    activities = activities.filter(activity => new Date(activity.date) >= start);
  }
  if (endDate) {
    const end = new Date(endDate as string);
    activities = activities.filter(activity => new Date(activity.date) <= end);
  }

  res.status(200).json(activities);
});

// Endpoint for listing challenges with optional filtering
app.get('/challenges', authenticateToken, (req: Request, res: Response) => {
  const { creatorId, title } = req.query;

  let challenges = [...challengesStorage.values()];

  if (creatorId) {
    challenges = challenges.filter(challenge => challenge.creatorId === creatorId);
  }
  if (title) {
    challenges = challenges.filter(challenge => challenge.title.includes(title as string));
  }

  res.status(200).json(challenges);
});

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
