const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running");
    });
  } catch (e) {
    console.log(e.message);
  }
};
initializeDBAndServer();

//Middleware function for authenticate jwtToken
const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "jwtToken", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API-1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const isUserExists = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(isUserExists);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const addUserQuery = `INSERT INTO user(name, username, password, gender) 
  VALUES ('${name}', '${username}', '${hashedPassword}', '${gender}')`;
    const addUser = await db.run(addUserQuery);
    response.status(200);
    response.send("User created successfully");
  }
});

//API-2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const userPassword = await bcrypt.compare(password, dbUser.password);
    if (userPassword === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "jwtToken");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-3
app.get("/user/tweets/feed/", authorization, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT follower.follower_user_id AS id FROM follower INNER JOIN user 
   ON follower.follower_user_id=user.user_id WHERE username='${username}'`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getTweetsQuery = `SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id INNER JOIN 
  user ON user.user_id=tweet.user_id WHERE follower.follower_user_id='${getUserId.id}' 
  ORDER BY tweet.date_time DESC LIMIT 4`;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

//API-4
app.get("/user/following/", authorization, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT follower.following_user_id AS id FROM follower INNER JOIN user 
   ON follower.following_user_id=user.user_id WHERE user.username='${username}'`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  const getTweetsQuery = `SELECT name 
    FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id 
    WHERE follower.following_user_id='${getUserId.id}'`;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

//API-5
app.get("/user/followers/", authorization, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT follower.follower_user_id AS id FROM follower INNER JOIN user 
   ON follower.follower_user_id=user.user_id WHERE user.username='${username}'`;
  const getUserId = await db.get(getUserIdQuery);

  const getTweetsQuery = `SELECT name 
    FROM user JOIN follower ON user.user_id = follower.following_user_id 
    WHERE follower.follower_user_id='${getUserId.id}'`;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

//API-6
app.get("/tweets/:tweetId/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const getTweetsQuery = `SELECT tweet, COUNT(like_id) AS likes, COUNT(reply_id) AS replies, date_time AS dateTime 
    FROM (reply NATURAL JOIN tweet) NATURAL JOIN like WHERE tweet_id = '${tweetId}'`;
  const getTweets = await db.all(getTweetsQuery);
  response.send(getTweets);
});

//API-7
app.get("/tweets/:tweetId/likes/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const likesQuery = `SELECT * FROM (tweet JOIN like ON like.tweet_id = 
    tweet.tweet_id) NATURAL JOIN user `;
  const getLikes = await db.all(likesQuery);
  console.log(getLikes);
});

//API-8
app.get(
  "/tweets/:tweetId/replies/",
  authorization,
  async (request, response) => {
    const { tweetId } = request.params;
    const repliesQuery = `SELECT * FROM (reply JOIN tweet ON reply.tweet_id = 
        tweet.tweet_id) NATURAL JOIN user`;
    const getReplies = await db.all(repliesQuery);
    console.log(getReplies);
  }
);

//API-9
app.get("/user/tweets/", authorization, async (request, response) => {
  const { username } = request;
  const getUserTweetsQuery = `SELECT tweet, COUNT(like_id) AS likes, COUNT(reply_id) 
    AS replies, date_time AS dateTime 
    FROM (user NATURAL JOIN tweet) NATURAL JOIN reply NATURAL JOIN like WHERE username = '${username}'`;
  const getUserTweets = await db.all(getUserTweetsQuery);
  console.log(username);
  console.log(getUserTweets);
  response.send(getUserTweets);
});

//API-10
app.post("/user/tweets/", authorization, async (request, response) => {
  const { tweet } = request.body;
  const addTweetQuery = `INSERT INTO tweet(tweet) 
    VALUES ('${tweet}')`;
  const addTweet = await db.run(addTweetQuery);
  console.log(addTweet);
  response.send("Created a Tweet");
});

//API-11
app.delete("/tweets/:tweetId/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUsersQuery = `SELECT * FROM user NATURAL JOIN 
  tweet WHERE username = '${username}'`;
  const getUser = await db.all(getUsersQuery);
  console.log(getUser);
  if (getUser.username === `${username}`) {
    const deleteTweetQuery = `DELETE from tweet WHERE tweet_id = '${tweetId}'`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
