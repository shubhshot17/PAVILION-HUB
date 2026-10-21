import numpy as np
import pandas as pd

VENUES = (
    "Harbor Oval",
    "Northgate Ground",
    "Lakeside Park",
    "Westport Oval",
)

WIN_FEATURES = (
    "runs",
    "wickets",
    "legal_balls_remaining",
    "target",
    "required_run_rate",
    "current_run_rate",
    "venue",
    "batting_team_strength",
    "bowling_team_strength",
)
SCORE_FEATURES = (
    "runs",
    "wickets",
    "legal_balls",
    "venue",
    "team_strength",
)


def make_win_data(
    samples: int = 20_000, random_state: int = 42
) -> tuple[pd.DataFrame, pd.Series]:
    """Generate explicitly fictional second-innings match states and outcomes."""
    rng = np.random.default_rng(random_state)
    balls_remaining = rng.integers(1, 121, size=samples)
    balls_bowled = 120 - balls_remaining
    targets = rng.integers(100, 251, size=samples)
    runs = np.minimum(
        rng.poisson(1.25 * balls_bowled),
        targets,
    )
    runs = np.minimum(runs, balls_bowled * 6)
    runs = np.minimum(runs, targets - 1)
    wickets = np.minimum(rng.integers(0, 11, size=samples), balls_bowled)
    batting_strength = rng.uniform(0, 1, size=samples)
    bowling_strength = rng.uniform(0, 1, size=samples)
    venues = rng.choice(VENUES, size=samples)
    current_rate = np.minimum(
        runs * 6 / np.maximum(balls_bowled, 1),
        60,
    )
    required_rate = np.maximum(targets - runs, 0) * 6 / balls_remaining

    venue_adjustment = np.select(
        [venues == VENUES[0], venues == VENUES[1], venues == VENUES[2]],
        [2.0, -1.0, 1.0],
        default=0.0,
    )
    resources = np.clip(1 - wickets * 0.065, 0.32, 1)
    runs_per_ball = 1.30 + 0.70 * (batting_strength - 0.5) - 0.65 * (
        bowling_strength - 0.5
    )
    projected_final = runs + balls_remaining * runs_per_ball * resources
    margin = projected_final + venue_adjustment - targets
    synthetic_probability = 1 / (1 + np.exp(-margin / 12))
    outcomes = rng.binomial(1, synthetic_probability)

    frame = pd.DataFrame(
        {
            "runs": runs,
            "wickets": wickets,
            "legal_balls_remaining": balls_remaining,
            "target": targets,
            "required_run_rate": required_rate,
            "current_run_rate": current_rate,
            "venue": venues,
            "batting_team_strength": batting_strength,
            "bowling_team_strength": bowling_strength,
        }
    )
    return frame.loc[:, WIN_FEATURES], pd.Series(outcomes, name="batting_team_won")


def make_score_data(
    samples: int = 20_000, random_state: int = 43
) -> tuple[pd.DataFrame, pd.Series]:
    """Generate fictional first-innings states and noisy final scores."""
    rng = np.random.default_rng(random_state)
    legal_balls = rng.integers(0, 121, size=samples)
    wickets = np.minimum(rng.integers(0, 11, size=samples), legal_balls)
    team_strength = rng.uniform(0, 1, size=samples)
    venues = rng.choice(VENUES, size=samples)
    runs = np.minimum(rng.poisson(1.25 * legal_balls), legal_balls * 6)
    remaining = 120 - legal_balls
    resources = np.clip(1 - wickets * 0.065, 0.32, 1)
    scoring_rate = 1.28 + 0.75 * (team_strength - 0.5)
    venue_adjustment = np.select(
        [venues == VENUES[0], venues == VENUES[1], venues == VENUES[2]],
        [4.0, -2.0, 2.0],
        default=0.0,
    )
    noise_scale = 5 + remaining * 0.10
    final_scores = np.clip(
        runs
        + remaining * scoring_rate * resources
        + venue_adjustment
        + rng.normal(0, noise_scale),
        0,
        400,
    )

    frame = pd.DataFrame(
        {
            "runs": runs,
            "wickets": wickets,
            "legal_balls": legal_balls,
            "venue": venues,
            "team_strength": team_strength,
        }
    )
    return frame.loc[:, SCORE_FEATURES], pd.Series(final_scores, name="final_score")
