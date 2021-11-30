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

It will generate the following files iside the `./tmp` folder:

```powershell
Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d----        30/11/2021     04:31                  daos
d----        30/11/2021     04:31                  schema

        Directory: .\tmp\daos


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a---        30/11/2021     04:31           3216   admin.dao.js
-a---        30/11/2021     04:31           1746   client.dao.js
-a---        30/11/2021     04:31            603   context.dao.js
-a---        30/11/2021     04:31            607   entity.dao.js
-a---        30/11/2021     04:31           2839   file.dao.js
-a---        30/11/2021     04:31           1678   goal.dao.js
-a---        30/11/2021     04:31           1370   office.dao.js
-a---        30/11/2021     04:31           1780   segment.dao.js
-a---        30/11/2021     04:31           1286   tag.dao.js

        Directory: .\tmp\schema


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-a---        30/11/2021     04:31            839   admin.schema.js
-a---        30/11/2021     04:31            755   client.schema.js
-a---        30/11/2021     04:31            247   context.schema.js
-a---        30/11/2021     04:31            328   entity.schema.js
-a---        30/11/2021     04:31            958   file.schema.js
-a---        30/11/2021     04:31            547   goal.schema.js
-a---        30/11/2021     04:31            707   office.schema.js
-a---        30/11/2021     04:31            625   segment.schema.js
-a---        30/11/2021     04:31            466   tag.schema.js
```

## TODO

The store files is not implemented yet.
