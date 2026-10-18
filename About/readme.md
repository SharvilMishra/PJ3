# Project brief

Build a professional energy-saving web application based on the supplied smart-home energy datasets. The application does not require user authentication in its initial scope. The frontend still needs to be designed.

The original brief asks whether a backend or database is necessary and considers Python or JavaScript for the backend, and Supabase/PostgreSQL or MySQL for a database.

## Dataset summary

- `Datasets/sic_IoT_dataset_PJ3.csv`: 5,832 hourly observations for one home, from 2025-01-01 through 2025-08-31. The project briefing treats this as the training/practice set.
- `Datasets/sic_IoT_test_PJ3.csv`: 30 sparse rows designated as test data in the project briefing.
- Data review found four inconsistencies between the test file's `date`/`hour` columns and `timestamp`, and three test timestamps also appear in training. Resolve or report these before claiming every test row is unseen.

The project briefing asks for three IF–THEN rules, checked on the 30-row test set, with no overlapping alerts. Discover and define the rules from training data; do not tune them on test rows. The HTML's rules are examples rather than required final rules. State assumptions clearly when presenting savings.
