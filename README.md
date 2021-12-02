# gql2store

Simple script to generate schema, dao and store from a GraphQL schema.

## Usage

Shows usage:

```powershell
node index.js --help
```

Run the script:

```powershell
node index.js ./examples/sdl.gql
```

It will generate the following files inside the `./tmp` folder:

```powershell
        Directory: ...\gql2store\tmp


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d----        02/12/2021     20:21                  daos
d----        02/12/2021     20:21                  schema
d----        02/12/2021     20:21                  store

        Directory: ...\gql2store\tmp\daos


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a---        02/12/2021     20:21           3216   admin.dao.ts
-a---        02/12/2021     20:21           1746   client.dao.ts
-a---        02/12/2021     20:21            603   context.dao.ts
-a---        02/12/2021     20:21            607   entity.dao.ts
-a---        02/12/2021     20:21           2839   file.dao.ts
-a---        02/12/2021     20:21           1678   goal.dao.ts
-a---        02/12/2021     20:21           1370   office.dao.ts
-a---        02/12/2021     20:21           1780   segment.dao.ts
-a---        02/12/2021     20:21           1286   tag.dao.ts

        Directory: ...\gql2store\tmp\schema


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a---        02/12/2021     20:21            837   admin.schema.ts
-a---        02/12/2021     20:21            820   client.schema.ts
-a---        02/12/2021     20:21            312   context.schema.ts
-a---        02/12/2021     20:21            326   entity.schema.ts
-a---        02/12/2021     20:21            956   file.schema.ts
-a---        02/12/2021     20:21            545   goal.schema.ts
-a---        02/12/2021     20:21            705   office.schema.ts
-a---        02/12/2021     20:21            623   segment.schema.ts
-a---        02/12/2021     20:21            464   tag.schema.ts

        Directory: ...\gql2store\tmp\store


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d----        02/12/2021     20:21                  modules
-a---        02/12/2021     20:21           1527   mutations.ts

        Directory: ...\gql2store\tmp\store\modules


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a---        02/12/2021     20:21           3533   admin.ts
-a---        02/12/2021     20:21           2605   client.ts
-a---        02/12/2021     20:21           1842   context.ts
-a---        02/12/2021     20:21           1767   entity.ts
-a---        02/12/2021     20:21           3256   file.ts
-a---        02/12/2021     20:21           2455   goal.ts
-a---        02/12/2021     20:21           2300   office.ts
-a---        02/12/2021     20:21           2587   segment.ts
-a---        02/12/2021     20:21           2157   tag.ts
```
