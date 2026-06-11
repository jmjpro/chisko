http -b GET 'https://data.gov.il/api/3/action/datastore_search' \
  resource_id=='e9701dcb-9f1c-43bb-bd44-eb380ade542f' \
  limit==3000 \
| jq '[.result.records[]
    | {
        hebrew: (."name_in_hebrew" | rtrimstr(" ")),
        english: (."name_in_english" | rtrimstr(" ")),
        arabic: (."name_in_arabic" | rtrimstr(" ")),
        russian: (."name_in_russian" | rtrimstr(" "))
      }
  ]'
