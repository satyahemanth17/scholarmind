import strawberry
from strawberry.asgi import GraphQL
from mangum import Mangum
from fastapi import FastAPI

app = FastAPI()


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "ok"


schema = strawberry.Schema(Query)
graphql_app = GraphQL(schema)

app.add_route("/graphql", graphql_app)

handler = Mangum(app)
