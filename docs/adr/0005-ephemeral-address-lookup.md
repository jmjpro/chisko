# Smart Meter Registry lookup inputs are not persisted on the Home Profile

The cascading address picker on the smart meter step collects city, street, and house number to look up the address in the Smart Meter Registry. Only `city` is stored on the Home Profile; street and house number are discarded after the lookup resolves `hasSmartMeter`.

We considered persisting all three fields so we could re-run the lookup automatically when the Smart Meter Registry refreshes (e.g., to upgrade a previously-unregistered address to `hasSmartMeter: "yes"`). We chose not to because a full street address is PII with no downstream use in the recommendation engine — city is the only address field used for supplier coverage checks. The marginal benefit of silent re-lookup doesn't justify retaining home address data indefinitely.
