# Common Arnold Flow Patterns

Reusable patterns for GraphQL API testing flows.

## Authentication Flow

Login, extract token, use in subsequent requests:

```json
{
  "name": "auth-flow",
  "baseUrl": "https://api.example.com/graphql",
  "headers": {
    "Authorization": "Bearer ${token}"
  },
  "steps": [
    {
      "name": "Login",
      "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token } }",
      "variables": {
        "email": "${EMAIL}",
        "password": "${PASSWORD}"
      },
      "extractToContext": {
        "token": "data.login.token"
      },
      "expected": {
        "data": { "login": { "token": "string" } }
      }
    },
    {
      "name": "Get Current User",
      "query": "query { me { id email name } }"
    }
  ]
}
```

## CRUD Operations

Create, read, update, delete pattern:

```json
{
  "name": "product-crud",
  "baseUrl": "https://api.example.com/graphql",
  "headers": {
    "Authorization": "Bearer ${API_KEY}"
  },
  "steps": [
    {
      "name": "Create Product",
      "query": "mutation CreateProduct($input: ProductInput!) { createProduct(input: $input) { id name } }",
      "variables": {
        "input": {
          "name": "Test Product",
          "price": 99.99
        }
      },
      "extractToContext": {
        "productId": "data.createProduct.id"
      }
    },
    {
      "name": "Read Product",
      "query": "query GetProduct($id: ID!) { product(id: $id) { id name price } }",
      "variables": {
        "id": "${productId}"
      }
    },
    {
      "name": "Update Product",
      "query": "mutation UpdateProduct($id: ID!, $input: ProductInput!) { updateProduct(id: $id, input: $input) { id name price } }",
      "variables": {
        "id": "${productId}",
        "input": {
          "name": "Updated Product",
          "price": 149.99
        }
      }
    },
    {
      "name": "Delete Product",
      "query": "mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) { success } }",
      "variables": {
        "id": "${productId}"
      },
      "expected": {
        "data": { "deleteProduct": { "success": true } }
      }
    }
  ]
}
```

## Pagination Flow

Fetch paginated data:

```json
{
  "name": "paginated-fetch",
  "baseUrl": "https://api.example.com/graphql",
  "steps": [
    {
      "name": "First Page",
      "query": "query ListItems($cursor: String) { items(first: 10, after: $cursor) { edges { node { id } } pageInfo { hasNextPage endCursor } } }",
      "extractToContext": {
        "cursor": "data.items.pageInfo.endCursor",
        "hasMore": "data.items.pageInfo.hasNextPage"
      }
    },
    {
      "name": "Second Page",
      "query": "query ListItems($cursor: String) { items(first: 10, after: $cursor) { edges { node { id } } pageInfo { hasNextPage endCursor } } }",
      "variables": {
        "cursor": "${cursor}"
      }
    }
  ]
}
```

## Multi-Entity Flow

Create related entities:

```json
{
  "name": "order-flow",
  "baseUrl": "https://api.example.com/graphql",
  "headers": {
    "Authorization": "Bearer ${token}"
  },
  "steps": [
    {
      "name": "Create Customer",
      "query": "mutation { createCustomer(name: \"John Doe\") { id } }",
      "extractToContext": {
        "customerId": "data.createCustomer.id"
      }
    },
    {
      "name": "Create Product",
      "query": "mutation { createProduct(name: \"Widget\", price: 25.00) { id } }",
      "extractToContext": {
        "productId": "data.createProduct.id"
      }
    },
    {
      "name": "Create Order",
      "query": "mutation CreateOrder($customerId: ID!, $productId: ID!) { createOrder(customerId: $customerId, items: [{ productId: $productId, quantity: 2 }]) { id total } }",
      "variables": {
        "customerId": "${customerId}",
        "productId": "${productId}"
      },
      "expected": {
        "data": { "createOrder": { "total": 50.00 } }
      }
    }
  ]
}
```

## Error Handling Pattern

Test error scenarios:

```json
{
  "name": "error-handling",
  "baseUrl": "https://api.example.com/graphql",
  "steps": [
    {
      "name": "Invalid Login",
      "query": "mutation { login(email: \"bad@example.com\", password: \"wrong\") { token } }",
      "expected": {
        "errors": [{ "message": "Invalid credentials" }]
      }
    },
    {
      "name": "Not Found",
      "query": "query { product(id: \"nonexistent\") { id } }",
      "expected": {
        "data": { "product": null }
      }
    }
  ]
}
```

## File Structure Best Practices

```
.arnold/
├── sets/
│   ├── auth-flow.json        # Authentication tests
│   ├── product-crud.json     # Product CRUD tests
│   └── integration.json      # Full integration flow
├── state.json                # Gitignored
└── .env                      # Gitignored
    EMAIL=test@example.com
    PASSWORD=testpass123
    API_KEY=sk-xxx
```

## Tips

1. **Prefix environment variables** with purpose: `AUTH_EMAIL`, `ADMIN_TOKEN`
2. **Use expected sparingly** - only for critical assertions
3. **Extract IDs early** - extract entity IDs immediately after creation
4. **Name steps clearly** - makes status output readable
5. **Keep flows focused** - one logical workflow per set
