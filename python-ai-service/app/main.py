import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request

from app.model import (
    DATA_SOURCE,
    PROJECTION_QUALIFICATION,
    QUALIFICATION,
    load_models,
    predict_first_innings_score,
    predict_win_probability,
)
from app.schemas import (
    FirstInningsProjectionRequest,
    FirstInningsProjectionResponse,
    ModelInfoResponse,
    WinProbabilityRequest,
    WinProbabilityResponse,
)

logger = logging.getLogger("pavilion_ai")


@asynccontextmanager
async def lifespan(application: FastAPI):
    try:
        application.state.models = load_models()
    except FileNotFoundError as error:
        application.state.models = None
        logger.warning("%s", error)
    yield


app = FastAPI(
    title="PAVILION HUB Experimental AI",
    description=(
        "Baseline cricket predictions trained on synthetic data only. "
        "Outputs are experimental and not validated for real matches."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


def require_models(request: Request) -> dict[str, Any]:
    models = getattr(request.app.state, "models", None)
    if models is None:
        raise HTTPException(
            status_code=503,
            detail="Models are not trained. Run the documented training command.",
        )
    return models


@app.get("/health", response_model=ModelInfoResponse)
def health(request: Request) -> ModelInfoResponse:
    models = getattr(request.app.state, "models", None)
    return ModelInfoResponse(
        ready=models is not None,
        data_source=DATA_SOURCE,
        qualification=QUALIFICATION,
        metrics=models["metrics"] if models else None,
    )


@app.post(
    "/predict/win-probability",
    response_model=WinProbabilityResponse,
)
def win_probability(
    payload: WinProbabilityRequest, request: Request
) -> dict[str, Any]:
    return predict_win_probability(require_models(request), payload.model_dump())


@app.post(
    "/predict/first-innings-score",
    response_model=FirstInningsProjectionResponse,
)
def first_innings_score(
    payload: FirstInningsProjectionRequest, request: Request
) -> dict[str, Any]:
    return predict_first_innings_score(require_models(request), payload.model_dump())


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info(request: Request) -> ModelInfoResponse:
    models = getattr(request.app.state, "models", None)
    qualification = (
        PROJECTION_QUALIFICATION if models is not None else QUALIFICATION
    )
    return ModelInfoResponse(
        ready=models is not None,
        data_source=DATA_SOURCE,
        qualification=qualification,
        metrics=models["metrics"] if models else None,
    )
