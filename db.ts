import { DatabaseSync } from 'node:sqlite'
const database = new DatabaseSync(':memory:')

// Execute SQL statements from strings.
export const createDataTable =() =>  database.exec(`
  CREATE TABLE data(
    key INTEGER PRIMARY KEY,
    value TEXT
  ) STRICT
`)

createDataTable()

// Create a prepared statement to insert data into the database.
export const insert = database.prepare('INSERT INTO data (key, value) VALUES (?, ?)')
// Execute the prepared statement with bound values.
insert.run(1, 'hello')
insert.run(2, 'world')

// Create a prepared statement to read data from the database.
const query = database.prepare('SELECT * FROM data ORDER BY key')

// Execute the prepared statement and log the result set.
console.log(query.all())
// Prints: [ { key: 1, value: 'hello' }, { key: 2, value: 'world' } ]
/*
<think>
Alright, so I've got this problem where I need to design a SQLite database
schema based on some TypeScript interfaces. The main interface is `ChatResponse`,
and it has several properties, including a `message` property which itself is
another interface called `Message`. Then, the `Message` interface can have
optional arrays of images or tool calls, with `tool_calls` being an array of
`ToolCall` objects, each containing a function with a name and arguments.

Okay, first step is to map these TypeScript interfaces to SQLite tables.
I know that SQLite doesn't support nested objects natively, so I need to flatten
these structures into separate tables with proper relationships.

Starting with the `ChatResponse` interface:

- **model**: A string representing the model name.
- **created_at**: A date when the response was created.
- **message**: An object of type `Message`.
- **done**: A boolean indicating if the process is done.
- **done_reason**: A string explaining why it's done, optional.
- **total_duration**: A number representing total duration.
- **load_duration**: A number for load duration.
- **prompt_eval_count**: Number of prompt evaluations.
- **prompt_eval_duration**: Duration spent on prompt evaluations.
- **eval_count**: Number of evaluations.
- **eval_duration**: Total evaluation duration.

For the `Message` interface:

- **role**: A string like 'user' or 'assistant'.
- **content**: The actual message content as a string.
- **images**: An optional array of either `Uint8Array` (byte arrays) or strings.
- **tool_calls**: An optional array of `ToolCall` objects.

And each `ToolCall` has:

- **function**: An object with:
  - **name**: The name of the function called.
  - **arguments**: An object where keys are strings and values can be any type.

So, I need to create tables that represent these structures while ensuring
relationships between them. Since SQLite doesn't support nested objects or
arrays directly, each complex property will likely need its own table with
foreign keys linking back to the main `ChatResponse` table.

First, for `ChatResponse`, it seems straightforward:

```sql
CREATE TABLE chat_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    done INTEGER NOT NULL,  -- 0 for false, 1 for true
    done_reason TEXT DEFAULT NULL,
    total_duration REAL DEFAULT 0.0,
    load_duration REAL DEFAULT 0.0,
    prompt_eval_count INTEGER DEFAULT 0,
    prompt_eval_duration REAL DEFAULT 0.0,
    eval_count INTEGER DEFAULT 0,
    eval_duration REAL DEFAULT 0.0
);
```

Now, for the `Message` interface, since it's a separate structure but part of
`ChatResponse`, I need to decide whether to store it as JSON in the `message`
column or create a separate table.

Given that `Message` has its own properties and optional arrays, it might be
better to create a separate table with a foreign key back to `chat_responses`.

So:

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_response_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(chat_response_id) REFERENCES chat_responses(id)
);
```

This way, each message is linked to its corresponding `chat_response`.

Now, for the `images` array in `Message`, since it can be an array of either
`Uint8Array` or strings, I need to decide how to store these. If they are byte
arrays, storing them as BLOBs makes sense. Strings could be stored as TEXT.

Given that SQLite supports both, perhaps create a separate table for images:

```sql
CREATE TABLE message_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    image_data BLOB,  -- For Uint8Array
    image_path TEXT,   -- For string paths
    FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

However, having both `image_data` and `image_path` might be redundant. Maybe
better to store images as separate entities with a discriminator column
indicating the type.

Alternatively, if all images are stored in one format (e.g., BLOB),
that simplifies it:

```sql
CREATE TABLE message_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    image_data BLOB NOT NULL,
    FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

Now, for the `tool_calls` array in `Message`, each tool call has a function with
a name and arguments. Since arguments can be any type, storing them as JSON
might be necessary.

So, create a table for `tool_calls`:

```sql
CREATE TABLE tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    function_name TEXT NOT NULL,
    arguments TEXT NOT NULL,  -- Stored as JSON string
    FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

Putting it all together, the complete schema would look like this:

```sql
CREATE TABLE chat_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    done INTEGER NOT NULL,
    done_reason TEXT DEFAULT NULL,
    total_duration REAL DEFAULT 0.0,
    load_duration REAL DEFAULT 0.0,
    prompt_eval_count INTEGER DEFAULT 0,
    prompt_eval_duration REAL DEFAULT 0.0,
    eval_count INTEGER DEFAULT 0,
    eval_duration REAL DEFAULT 0.0
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_response_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(chat_response_id) REFERENCES chat_responses(id)
);

CREATE TABLE message_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    image_data BLOB NOT NULL,
    FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE TABLE tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    function_name TEXT NOT NULL,
    arguments TEXT NOT NULL,  -- JSON string
    FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

This schema separates each component into its own table with foreign keys to
maintain relationships. It allows for efficient querying and maintains data
integrity through foreign key constraints.

However, storing `arguments` as a JSON string in the `tool_calls` table might
require additional handling when inserting or querying data, but it provides
flexibility since the arguments can be of any type.

Also, storing images as BLOBs is efficient if the number of images per message
isn't excessively large. If there are many images, it might impact database
performance, so consider whether a separate storage solution for images
(like an object store) would be more appropriate and store only references in
the database.
</think>

To design a SQLite database schema based on the provided TypeScript interfaces,
we need to map the nested structures into relational tables with appropriate
relationships. Here's how you can achieve this:

### Tables Overview

1. **chat_responses**: Stores information about each chat response.
2. **messages**: Stores message details related to each chat response.
3. **message_images**: Stores images associated with a message.
4. **tool_calls**: Stores tool calls associated with a message.

### Schema Definition

```sql
-- Create the chat_responses table
CREATE TABLE chat_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    done INTEGER NOT NULL,  -- 0 for false, 1 for true
    done_reason TEXT DEFAULT NULL,
    total_duration REAL DEFAULT 0.0,
    load_duration REAL DEFAULT 0.0,
    prompt_eval_count INTEGER DEFAULT 0,
    prompt_eval_duration REAL DEFAULT 0.0,
    eval_count INTEGER DEFAULT 0,
    eval_duration REAL DEFAULT 0.0
);

-- Create the messages table with foreign key to chat_responses
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_response_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY(chat_response_id) REFERENCES chat_responses(id)
);

-- Create the message_images table with foreign key to messages
CREATE TABLE message_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    image_data BLOB NOT NULL,  -- Stores images as binary data
    FOREIGN KEY(message_id) REFERENCES messages(id)
);

-- Create the tool_calls table with foreign key to messages and stores arguments
as JSON

CREATE TABLE tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    function_name TEXT NOT NULL,
    arguments TEXT NOT NULL,  -- Arguments stored as a JSON string
    FOREIGN KEY(message_id) REFERENCES messages(id)
);
```

### Explanation

1. **chat_responses**: This table captures all the details of each chat response,
including whether it's done and various duration metrics.

2. **messages**: Each message is linked to a specific `chat_response` via the
`chat_response_id`. It stores the role and content of the message.

3. **message_images**: This table stores images related to messages.
The `image_data` field stores the image as binary data (BLOB), suitable for
handling different types of images efficiently.

4. **tool_calls**: Each tool call is associated with a message via `message_id`.
It includes the function name and arguments stored as JSON, allowing flexibility
in argument types and structures.

### Usage Considerations

- **Storing Images**: If your application handles many large images, consider
using an external storage service for images and store only references
(URLs or file paths) in the database to optimize performance.

- **Handling Arguments**: Since `arguments` are stored as JSON strings, you may
need to use JSON-specific functions when querying or inserting data into the
`tool_calls` table.

This schema effectively maps the nested structures of the TypeScript interfaces
into a relational database model, maintaining relationships and allowing for
efficient data management.
*/
