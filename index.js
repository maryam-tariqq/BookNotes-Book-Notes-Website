import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

let isbn;

let books = [];
let booksSearch = [];


const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Library",
  password: "123456",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function getBooks(){
  const result = await db.query(
    "SELECT id, name, isbn FROM books"
  )
    books = result.rows;
    return books;
  }

app.get("/", async(req, res) => {
  const books = await getBooks();
  res.render("index.ejs",{
  books: books
  });
})

//to handle "/reviews" route after uses clicks a book
app.post("/reviews", async(req, res) => {
  const input = req.body.id;
  console.log(input);
  try{
    const result1 = await db.query(
      "SELECT name,isbn,author,category FROM books WHERE id = $1;",
      [input]
    );
    const data1 = result1.rows[0];

    const result2 = await db.query(
      "SELECT dated,rating FROM ratings WHERE book_id = $1;",
      [input]
    )
    const data2 = result2.rows[0];

    const result3 = await db.query(
      "SELECT review FROM reviews WHERE book_id = $1",
      [input]
    )
    const data3 = result3.rows[0];

    res.render("review.ejs",{
      id: input,
      name: data1.name,
      author: data1.author,
      isbn:data1.isbn,
      category:data1.category,
      rating:data2.rating,
      dated:data2.dated,
      review:data3.review
    });
  }catch(error){
    console.log(error);
    res.redirect("/");
  }
  
});

//to handle "/add" route for user to enter review of a new book
app.get("/add", (req, res) => {
  res.render("add.ejs");
})

app.post("/add", async(req, res) => {
  const name = req.body.name;
  const author = req.body.author;
  const isbn = req.body.isbn;
  const category = req.body.genre;
  const rating = req.body.rating;
  const dated = req.body.dated;
  const review = req.body.review;
  
  try{
    const response = await db.query(
      "INSERT INTO books (name, isbn, author, category) VALUES ($1, $2, $3, $4) RETURNING id;",
      [name, isbn, author, category] 
    );
    const id = response.rows[0].id;

    await db.query(
      "INSERT INTO ratings (rating, dated, book_id) VALUES ($1, $2, $3);",
      [rating, dated, id]
    )

    await db.query(
      "INSERT INTO reviews (review, book_id) VALUES ($1, $2);",
      [review, id]
    )
    res.redirect("/");
  }catch (e){
    console.log(e);
  }
  
})



//handling user search for books when user enters book name
app.post("/search", async(req, res) => {
  const sortBy = req.body.genre;
  const searchInput = req.body.search;
  if(sortBy){
    //if user chooses sort-by method
    if(sortBy === "rating"){
      const result = await db.query(
        "SELECT books.id, books.name, books.isbn, rating FROM books INNER JOIN ratings ON books.id = ratings.book_id ORDER BY ratings.rating DESC;"
      )
      booksSearch = result.rows;
      const heading = "Rating: High -> Low";
      res.render("search.ejs",{
        books: booksSearch,
        heading: heading
      });

    } else if(sortBy === "recency"){
      const result = await db.query(
        "SELECT books.id, books.name, books.isbn, dated FROM books INNER JOIN ratings ON books.id = ratings.book_id ORDER BY ratings.dated DESC;"
      )
      booksSearch = result.rows;
      console.log("booksSearch");
      const heading = "Recently Reviewed";
      res.render("search.ejs",{
        books: booksSearch,
        heading: heading
      });

    }else{
      const heading = sortBy;
      const input = sortBy.toLowerCase();
      console.log(input);
      if(input === "non-fiction" || input === "mystery" || input === "young adult" || input === "fantasy" || input === "self-help"){
        const response = await db.query(
          "SELECT id, name, isbn FROM books WHERE LOWER (category) = $1;",
          [input]
        );
        booksSearch = response.rows;
        console.log(booksSearch);
      }
      res.render("search.ejs",{
        books: booksSearch,
        heading: heading
      });
    }
  } else if (searchInput && searchInput.trim() !== "") {
      const input = req.body.search;
     
      const title = input.trim().toLowerCase();
      
  
      try {
          // Get cover edition key using title input to get ISBN number
          const response = await axios.get(
              `https://openlibrary.org/search.json?title=${title}`
          );
          const data = response.data;
         
          if (data.docs && data.docs.length > 0) {
              const key = data.docs[0].cover_edition_key;
              
  
              // Use key to get ISBN number
              const response1 = await axios.get(
                  `https://openlibrary.org/books/${key}.json`
              );
              const data1 = response1.data;
             
              if (data1.isbn_13 && data1.isbn_13.length > 0) {
                isbn = data1.isbn_13[0];
                
  
                  // Checking if book exists in the database
                  const result = await db.query(
                      "SELECT isbn FROM books WHERE isbn = $1;", [isbn]
                  );
                  
                  if (result.rows.length > 0) {
                      const isbnRead = result.rows[0].isbn;
                      
                      if (isbnRead == isbn) {
                          const result = await db.query(
                              "SELECT id, name, isbn FROM books WHERE isbn = $1",
                              [isbn]
                          );
                          booksSearch = result.rows;
                          const heading = result.rows[0].name;
                         
                          res.render("search.ejs", {
                              books: booksSearch,
                              heading: heading,
                              error: null
                          });
                      }
                  } else {
                      console.log("Book doesn't exist in database");
                      res.render("search.ejs", {
                          books: [],
                          heading: "No results",
                          error: "Book doesn't exist"
                      });
                  }
              } else {
                  console.log("ISBN not found");
              }
          } else {
              console.log("No books found");
              res.render("search.ejs", {
                  books: [],
                  heading: "No results",
                  error: "No books found"
              });
          }
      } catch (error) {
          // Log the error details for better debugging
          console.error("Axios Error: ", error.message);
          if (error.response) {
              // Server responded with a status code outside of the 2xx range
              console.error("Response data: ", error.response.data);
              console.error("Response status: ", error.response.status);
          } else if (error.request) {
              // No response was received
              console.error("No response received: ", error.request);
          } else {
              // Other errors
              console.error("Error in setting up request: ", error.message);
          }
  
          // Render an error page
          res.render("error.ejs", { error: "An error occurred while searching" });
      }
  }
  

})


app.post("/edit", async(req, res) => {
  const id = req.body.updatedId;
  const name = req.body.name;
  const isbn = req.body.isbn;
  const author = req.body.author;
  const category = req.body.category;
  const rating = req.body.rating;
  const dated = req.body.dated;
  const review = req.body.review;

  await db.query(
    "UPDATE books SET name = $1, isbn= $2, author = $3, category = $4 WHERE id = $5",
    [name, isbn, author, category, id]
  );
  await db.query(
    "UPDATE ratings SET rating = $1, dated = $2 WHERE book_id = $3;",
    [rating, dated, id]
  );
  await db.query(
    "UPDATE reviews SET review = $1 WHERE book_id = $2;",
    [review, id]
  );
  
  res.redirect(`/reviews/${id}`);
})

app.get("/reviews/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result1 = await db.query(
      "SELECT name,isbn,author,category FROM books WHERE id = $1;",
      [id]
    );
    const data1 = result1.rows[0];

    const result2 = await db.query(
      "SELECT dated, rating FROM ratings WHERE book_id = $1;",
      [id]
    );
    const data2 = result2.rows[0];

    const result3 = await db.query(
      "SELECT review FROM reviews WHERE book_id = $1;",
      [id]
    );
    const data3 = result3.rows[0];

    console.log(data2.dated);
    res.render("review.ejs", {
      id: id,
      name: data1.name,
      author: data1.author,
      isbn: data1.isbn,
      category: data1.category,
      rating: data2.rating,
      dated: data2.dated,
      review: data3.review
    });
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});

app.post("/delete", async(req, res) => {
  const id = req.body.deletedId;
  try{
    await db.query(
      "DELETE FROM reviews WHERE book_id = $1", [id]
    )
    await db.query(
      "DELETE FROM ratings WHERE book_id = $1", [id]
    )
    await db.query(
      "DELETE FROM books WHERE id = $1", [id]
    )
    res.redirect("/");
  }catch(e){
    console.log(e);
  }
  
})


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});


