CREATE TABLE books(
    id SERIAL PRIMARY KEY,
    name TEXT,
    isbn TEXT,
    author TEXT,
    category TEXT
);

CREATE TABLE ratings(
    id SERIAL PRIMARY KEY,
    rating INTEGER,
    dated TEXT,
    book_id INTEGER REFERENCES books(id)
);

CREATE TABLE reviews(
    id SERIAL PRIMARY KEY,
    review TEXT,
    book_id INTEGER REFERENCES books(id)
);