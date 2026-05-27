#!/usr/bin/env python3
"""
Carbonet RAG - Requirements Q&A
Vector DB: /opt/vector_db/requirements_mapping_optimized
Uses local Qwen2.5 Coder 7B model via llama.cpp
"""

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.llms import OpenAI
from langchain_core.runnables import RunnablePassthrough
import os

# Vector DB
VECTOR_DB_PATH = "/opt/vector_db/requirements_mapping_optimized"

# Local model server (llama.cpp on port 24751)
MODEL_SERVER_URL = "http://127.0.0.1:24751"
MODEL_NAME = "qwen2.5-coder-7b-instruct-shadow"

def format_docs(docs):
    return "\n\n".join([doc.page_content for doc in docs])

def create_rag_chain():
    """Create RAG chain with vector store and local LLM."""
    
    # 1. Load vector store
    print("Loading vector store...")
    vectorstore = Chroma(
        persist_directory=VECTOR_DB_PATH,
        collection_name="requirements_mapping",
        embedding_function=HuggingFaceEmbeddings(model_name="jhgan/ko-sbert-nli")
    )
    print(f"Vector store loaded: {vectorstore._collection.count()} documents")
    
    # 2. Initialize local LLM
    print(f"Connecting to local model at {MODEL_SERVER_URL}...")
    llm = OpenAI(
        openai_api_key="qwer1234",
        openai_api_base=f"{MODEL_SERVER_URL}/v1",
        model_name=MODEL_NAME,
        temperature=0,
        max_tokens=512,
        timeout=120,
    )
    
    # 3. Create retriever
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    
    # 4. Create prompt
    prompt = ChatPromptTemplate.from_template("""
You are a requirements expert for the Carbonet system. Answer the question based on the retrieved documents.
If the answer is not in the documents, say so clearly.

Retrieved documents:
{context}

Question: {question}

Answer:
""")
    
    # 5. Create RAG chain
    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    return rag_chain

def query_rag(query: str):
    """Query the RAG system."""
    rag_chain = create_rag_chain()
    
    print(f"\nQuery: {query}")
    print("=" * 50)
    
    result = rag_chain.invoke(query)
    
    print(f"\nAnswer: {result}")
    
    return result

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        query_rag(query)
    else:
        # Interactive mode
        print("Carbonet RAG - Requirements Q&A")
        print("Type 'quit' to exit")
        print()
        
        while True:
            query = input("Query: ").strip()
            if query in ("quit", "exit", "q"):
                break
            if query:
                query_rag(query)
                print()