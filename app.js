const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "eCommerce.db");
let db = null;

const initalizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(5001, () => {
      console.log("server is running at http://localhost:5001");
    });
  } catch (error) {
    console.log(`DB Error ${error}`);
  }
};

initalizeDBAndServer();

const verifyUser = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("invalid access token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("invalid access token");
      } else {
        next();
      }
    });
  }
};

//API 1 Register Users
app.post("/users/register", async (request, response) => {
  const userDetails = request.body;
  const { firstname, lastname, username, password } = userDetails;
  const encryptedPassword = await bcrypt.hash(password, 10);
  const getuserQuery = `
    SELECT username
    FROM users
    WHERE username='${username}';`;
  const createUserQuery = `
    INSERT INTO users(firstname, lastname, username, password)
    VALUES('${firstname}','${lastname}','${username}','${encryptedPassword}');
    `;
  const isUserPresent = await db.get(getuserQuery);
  if (isUserPresent === undefined) {
    await db.run(createUserQuery);
    response.status(200);
    response.send("user created successfully");
  } else {
    response.status(400);
    response.send("user already exist");
  }
});

//API 2 Login User
app.post("/users/login", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT
        *
    FROM
        users
    WHERE
        username='${username}';
    `;
  const dbResponse = await db.get(getUserQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("user not exist");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordCorrect) {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("incorrect password");
    }
  }
});

//API 3 Get List of Products
app.get("/products", verifyUser, async (request, response) => {
  const getProducts = `
    SELECT
        *
    FROM
        products;`;
  const dbResponse = await db.all(getProducts);
  response.status(200);
  response.send(dbResponse);
});

//API 4 Get Product Details
app.get("/product-details/:id", verifyUser, async (request, response) => {
  const { id } = request.params;
  const getProduct = `
    SELECT
        *
    FROM
        products
    WHERE
        id=${id};
    `;
  const dbResponse = await db.get(getProduct);
  response.status(200);
  response.send(dbResponse);
});

//API 5 Add Product to Cart
app.get("/add-product/:pid", verifyUser, async (request, response) => {
  const { pid } = request.params;
  const getProduct = `
    SELECT
        *
    FROM
        products
    WHERE
        id=${pid};`;
  const dbResponseProduct = await db.get(getProduct);
  const { id, product_name, description, image_url, price } = dbResponseProduct;
  const getProductFromCart = `
    SELECT
        *
    FROM
        cart
    WHERE id=${id};`;
  const cartItem = await db.get(getProductFromCart);
  const addProductToCart = `
    INSERT INTO cart(id, product_name, description, image_url, price)
    VALUES(${id},'${product_name}','${description}','${image_url}',${price});`;
  if (cartItem === undefined) {
    await db.run(addProductToCart);
    response.status(200);
    response.send("product added");
  } else {
    response.send("product already added");
  }
});

//API 6 Get Cart Items
app.get("/cart-items", verifyUser, async (request, response) => {
  const getCartItems = `
    SELECT
        *
    FROM
        cart;`;
  const dbResponse = await db.all(getCartItems);
  response.status(200);
  response.send(dbResponse);
});

//API 7 Remove Product from Cart
app.delete("/remove-product/:pid", verifyUser, async (request, response) => {
  const { pid } = request.params;
  const removeProduct = `
    DELETE FROM cart
    WHERE id=${pid};`;
  await db.run(removeProduct);
  response.status(200);
  response.send("product removed from cart");
});
