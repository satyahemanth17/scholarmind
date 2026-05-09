from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env")

import os
# .env uses SUPABASE_SERVICE_KEY; handlers expect SUPABASE_KEY
if not os.environ.get("SUPABASE_KEY"):
    os.environ["SUPABASE_KEY"] = os.environ.get("SUPABASE_SERVICE_KEY", "")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.handlers.upload import app as upload_app
from src.handlers.query import app as query_app
from src.handlers.quiz import app as quiz_app
from src.handlers.graphql import app as graphql_app, graphql_app as gql_asgi

app = FastAPI(title="ScholarMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Merge routes from each sub-app into the combined app
for route in upload_app.routes:
    app.routes.append(route)
for route in query_app.routes:
    app.routes.append(route)
for route in quiz_app.routes:
    app.routes.append(route)

# GraphQL is a raw ASGI app — mount it directly
app.mount("/graphql", gql_asgi)
