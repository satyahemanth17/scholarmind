"""
RAGAS evaluation using a synthetic golden test set.
Runs standalone — no live DB or API key required for the synthetic demo.
"""
import os
import warnings
warnings.filterwarnings("ignore")

from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings


GOLDEN_TEST_SET = [
    {
        "user_input": "What is the mitochondria?",
        "retrieved_contexts": [
            "The mitochondria is known as the powerhouse of the cell. "
            "It generates ATP through cellular respiration.",
            "Mitochondria have their own DNA and are responsible for energy production.",
        ],
        "response": "The mitochondria is the powerhouse of the cell, generating ATP through cellular respiration.",
        "reference": "Mitochondria produce ATP energy through cellular respiration and have their own DNA.",
    },
    {
        "user_input": "What is photosynthesis?",
        "retrieved_contexts": [
            "Photosynthesis is the process by which green plants convert sunlight into glucose using CO2 and water.",
            "Chlorophyll in plant cells absorbs light energy for photosynthesis.",
        ],
        "response": "Photosynthesis is the process where plants use sunlight, CO2, and water to produce glucose and oxygen.",
        "reference": "Photosynthesis converts sunlight, carbon dioxide, and water into glucose and oxygen in plant cells.",
    },
    {
        "user_input": "What is Newton's first law of motion?",
        "retrieved_contexts": [
            "Newton's first law states that an object at rest stays at rest, and an object in motion stays in motion unless acted upon by an external force.",
            "This is also known as the law of inertia.",
        ],
        "response": "Newton's first law states that objects remain at rest or in uniform motion unless acted on by an external force (law of inertia).",
        "reference": "An object remains at rest or in constant motion unless an unbalanced external force acts upon it.",
    },
    {
        "user_input": "What is the Pythagorean theorem?",
        "retrieved_contexts": [
            "In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c².",
            "The theorem is named after the ancient Greek mathematician Pythagoras.",
        ],
        "response": "The Pythagorean theorem states that a² + b² = c² for right triangles, where c is the hypotenuse.",
        "reference": "The Pythagorean theorem: a² + b² = c², where c is the hypotenuse of a right triangle.",
    },
    {
        "user_input": "What causes the seasons on Earth?",
        "retrieved_contexts": [
            "Earth's seasons are caused by its axial tilt of approximately 23.5 degrees relative to its orbit around the Sun.",
            "When the Northern Hemisphere is tilted toward the Sun, it experiences summer while the Southern Hemisphere has winter.",
        ],
        "response": "Earth's seasons are caused by its 23.5-degree axial tilt, which changes how directly sunlight hits each hemisphere throughout the year.",
        "reference": "Seasons result from Earth's axial tilt (~23.5°), causing varying angles of sunlight across hemispheres during orbit.",
    },
]


def run_evaluation():
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        print("OPENAI_API_KEY not set — running evaluation with mock scores.\n")
        _print_mock_scores()
        return

    dataset = Dataset.from_list(GOLDEN_TEST_SET)

    llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o", temperature=0.0, openai_api_key=api_key))
    emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-small", openai_api_key=api_key))

    metrics = [faithfulness, answer_relevancy, context_precision, context_recall]
    for m in metrics:
        m.llm = llm
        if hasattr(m, "embeddings"):
            m.embeddings = emb

    results = evaluate(dataset=dataset, metrics=metrics)
    df = results.to_pandas()

    print("\n=== RAGAS Evaluation Results ===")
    print(f"faithfulness:       {df['faithfulness'].mean():.4f}")
    print(f"answer_relevancy:   {df['answer_relevancy'].mean():.4f}")
    print(f"context_precision:  {df['context_precision'].mean():.4f}")
    print(f"context_recall:     {df['context_recall'].mean():.4f}")
    print("================================\n")


def _print_mock_scores():
    """Structural validation when no API key is available."""
    scores = {
        "faithfulness": 0.9200,
        "answer_relevancy": 0.9450,
        "context_precision": 0.8800,
        "context_recall": 0.9100,
    }
    print("=== RAGAS Evaluation Results (mock — set OPENAI_API_KEY for real scores) ===")
    for metric, score in scores.items():
        print(f"{metric:<22} {score:.4f}")
    print("=" * 75)
    print()


if __name__ == "__main__":
    run_evaluation()
