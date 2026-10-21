from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WinProbabilityRequest(StrictRequest):
    runs: int = Field(ge=0, le=500)
    wickets: int = Field(ge=0, le=10)
    legal_balls_remaining: int = Field(ge=0, le=120)
    target: int = Field(ge=1, le=400)
    required_run_rate: float = Field(ge=0, le=60)
    current_run_rate: float = Field(ge=0, le=60)
    venue: str = Field(min_length=1, max_length=120)
    batting_team_strength: float = Field(ge=0, le=1)
    bowling_team_strength: float = Field(ge=0, le=1)

    @field_validator("venue")
    @classmethod
    def venue_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("venue must not be blank")
        return value.strip()


class FirstInningsProjectionRequest(StrictRequest):
    runs: int = Field(ge=0, le=500)
    wickets: int = Field(ge=0, le=10)
    legal_balls: int = Field(ge=0, le=120)
    venue: str = Field(min_length=1, max_length=120)
    team_strength: float = Field(ge=0, le=1)

    @field_validator("venue")
    @classmethod
    def venue_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("venue must not be blank")
        return value.strip()


class WinProbabilityResponse(BaseModel):
    batting_team_win_probability: float = Field(ge=0, le=1)
    probability_is_calibrated: Literal[False] = False
    qualification: str
    data_source: str
    model_version: str


class FirstInningsProjectionResponse(BaseModel):
    projected_total: int = Field(ge=0, le=400)
    approximate_low: int = Field(ge=0, le=400)
    approximate_high: int = Field(ge=0, le=400)
    range_is_calibrated: Literal[False] = False
    qualification: str
    data_source: str
    model_version: str


class ModelInfoResponse(BaseModel):
    ready: bool
    data_source: str
    qualification: str
    metrics: dict[str, Any] | None
