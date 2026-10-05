# IncidAI upstream source snapshot

This directory preserves the relevant source from the public AgorAI-Hackathon/IncidAI repository. Installed dependency directories and redundant train/validation/test/raw CSV copies are excluded; the processed clean historical ticket dataset remains available to the API's transparent TF-IDF classifier and retrieval service.

The upstream serialized classifier, vectorizer, sentence embeddings, FAISS index, and fine-tuned weights were not present in the repository. The running application therefore uses lexical TF-IDF retrieval over the included historical tickets and labels that method in the UI/API. It does not claim to run the missing trained models or an LLM. Suggested resolution steps are review-only and require a person to verify completion.
