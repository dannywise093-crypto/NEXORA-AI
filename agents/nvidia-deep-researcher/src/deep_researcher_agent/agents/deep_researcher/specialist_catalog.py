"""NEXORA's 200 on-demand specialist roles for NVIDIA Deep Research."""

import re

SPECIALIST_ROLE_ROWS = [
    [
        "Central Intelligence and Management",
        "Research Orchestrator Agent"
    ],
    [
        "Central Intelligence and Management",
        "Master Intelligence Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Planning Agent"
    ],
    [
        "Central Intelligence and Management",
        "Task Distribution Agent"
    ],
    [
        "Central Intelligence and Management",
        "Multi-Agent Coordination Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Workflow Manager"
    ],
    [
        "Central Intelligence and Management",
        "Research Priority Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Scheduling Agent"
    ],
    [
        "Central Intelligence and Management",
        "Parallel Research Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Quality Controller"
    ],
    [
        "Central Intelligence and Management",
        "Research Progress Monitor"
    ],
    [
        "Central Intelligence and Management",
        "Research Recovery Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Decision Support Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Optimization Agent"
    ],
    [
        "Central Intelligence and Management",
        "Research Session Manager"
    ],
    [
        "Global Information Gathering",
        "Global Web Search Agent"
    ],
    [
        "Global Information Gathering",
        "Academic Research Agent"
    ],
    [
        "Global Information Gathering",
        "Scientific Publications Agent"
    ],
    [
        "Global Information Gathering",
        "News Intelligence Agent"
    ],
    [
        "Global Information Gathering",
        "Historical Research Agent"
    ],
    [
        "Global Information Gathering",
        "Government Publications Agent"
    ],
    [
        "Global Information Gathering",
        "Patent Research Agent"
    ],
    [
        "Global Information Gathering",
        "Technical Documentation Agent"
    ],
    [
        "Global Information Gathering",
        "Industry Research Agent"
    ],
    [
        "Global Information Gathering",
        "Market Intelligence Agent"
    ],
    [
        "Global Information Gathering",
        "Open-Source Intelligence Agent"
    ],
    [
        "Global Information Gathering",
        "Digital Library Research Agent"
    ],
    [
        "Global Information Gathering",
        "Legal Documentation Research Agent"
    ],
    [
        "Global Information Gathering",
        "Environmental Research Agent"
    ],
    [
        "Global Information Gathering",
        "International Organization Research Agent"
    ],
    [
        "Global Information Gathering",
        "Conference and Journal Research Agent"
    ],
    [
        "Global Information Gathering",
        "Standards and Regulations Research Agent"
    ],
    [
        "Global Information Gathering",
        "Multimedia Research Agent"
    ],
    [
        "Global Information Gathering",
        "Public Dataset Discovery Agent"
    ],
    [
        "Global Information Gathering",
        "Expert Knowledge Discovery Agent"
    ],
    [
        "Scientific Research",
        "Physics Research Agent"
    ],
    [
        "Scientific Research",
        "Quantum Computing Research Agent"
    ],
    [
        "Scientific Research",
        "Chemistry Research Agent"
    ],
    [
        "Scientific Research",
        "Biology Research Agent"
    ],
    [
        "Scientific Research",
        "Biotechnology Research Agent"
    ],
    [
        "Scientific Research",
        "Genetics Research Agent"
    ],
    [
        "Scientific Research",
        "Neuroscience Research Agent"
    ],
    [
        "Scientific Research",
        "Astronomy Research Agent"
    ],
    [
        "Scientific Research",
        "Astrophysics Research Agent"
    ],
    [
        "Scientific Research",
        "Space Science Research Agent"
    ],
    [
        "Scientific Research",
        "Mathematics Research Agent"
    ],
    [
        "Scientific Research",
        "Applied Mathematics Agent"
    ],
    [
        "Scientific Research",
        "Statistics Research Agent"
    ],
    [
        "Scientific Research",
        "Climate Science Agent"
    ],
    [
        "Scientific Research",
        "Geology Research Agent"
    ],
    [
        "Scientific Research",
        "Oceanography Research Agent"
    ],
    [
        "Scientific Research",
        "Materials Science Agent"
    ],
    [
        "Scientific Research",
        "Nanotechnology Research Agent"
    ],
    [
        "Scientific Research",
        "Energy Science Agent"
    ],
    [
        "Scientific Research",
        "Medical Science Literature Agent"
    ],
    [
        "Engineering and Technology",
        "Mechanical Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Civil Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Structural Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Electrical Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Electronics Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Aerospace Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Automotive Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Robotics Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Mechatronics Agent"
    ],
    [
        "Engineering and Technology",
        "Chemical Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Software Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Computer Architecture Agent"
    ],
    [
        "Engineering and Technology",
        "Semiconductor Research Agent"
    ],
    [
        "Engineering and Technology",
        "Telecommunications Research Agent"
    ],
    [
        "Engineering and Technology",
        "Artificial Intelligence Research Agent"
    ],
    [
        "Engineering and Technology",
        "Machine Learning Research Agent"
    ],
    [
        "Engineering and Technology",
        "Cybersecurity Research Agent"
    ],
    [
        "Engineering and Technology",
        "Cloud Infrastructure Research Agent"
    ],
    [
        "Engineering and Technology",
        "Database Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Industrial Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Manufacturing Research Agent"
    ],
    [
        "Engineering and Technology",
        "Renewable Energy Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Thermal Engineering Agent"
    ],
    [
        "Engineering and Technology",
        "Fluid Mechanics Agent"
    ],
    [
        "Engineering and Technology",
        "Biomedical Engineering Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Global Economic Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Financial Markets Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Banking Intelligence Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Cryptocurrency Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Blockchain Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Investment Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Corporate Intelligence Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Business Strategy Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Supply Chain Intelligence Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Commodity Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Real Estate Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Insurance Research Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "International Trade Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Economic Forecasting Agent"
    ],
    [
        "Financial and Economic Intelligence",
        "Financial Risk Analysis Agent"
    ],
    [
        "Investigation and Verification",
        "Fact-Checking Agent"
    ],
    [
        "Investigation and Verification",
        "Source Credibility Agent"
    ],
    [
        "Investigation and Verification",
        "Citation Verification Agent"
    ],
    [
        "Investigation and Verification",
        "Contradiction Detection Agent"
    ],
    [
        "Investigation and Verification",
        "Evidence Analysis Agent"
    ],
    [
        "Investigation and Verification",
        "Research Gap Detection Agent"
    ],
    [
        "Investigation and Verification",
        "Information Consistency Agent"
    ],
    [
        "Investigation and Verification",
        "Data Integrity Agent"
    ],
    [
        "Investigation and Verification",
        "Statistical Verification Agent"
    ],
    [
        "Investigation and Verification",
        "Research Critic Agent"
    ],
    [
        "Investigation and Verification",
        "Independent Review Agent"
    ],
    [
        "Investigation and Verification",
        "Misinformation Detection Agent"
    ],
    [
        "Investigation and Verification",
        "Duplicate Source Detection Agent"
    ],
    [
        "Investigation and Verification",
        "Unsupported Claims Detection Agent"
    ],
    [
        "Investigation and Verification",
        "Research Confidence Assessment Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Data Collection Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Data Cleaning Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Data Transformation Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Data Visualization Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Big Data Analysis Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Predictive Analytics Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Statistical Modeling Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Pattern Recognition Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Trend Detection Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Anomaly Detection Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Simulation Research Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Mathematical Modeling Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Geospatial Analysis Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Time-Series Analysis Agent"
    ],
    [
        "Advanced Data Intelligence",
        "Dataset Comparison Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Technology Forecasting Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Economic Forecasting Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Scientific Discovery Analysis Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Industry Trend Forecasting Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Innovation Intelligence Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Emerging Technology Detection Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Scenario Planning Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Strategic Risk Assessment Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Competitive Intelligence Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Long-Term Trend Analysis Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Research Opportunity Detection Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Future Technology Assessment Agent"
    ],
    [
        "Strategic Intelligence and Forecasting",
        "Strategic Decision Support Agent"
    ],
    [
        "Research Writing and Publication",
        "Research Report Writer"
    ],
    [
        "Research Writing and Publication",
        "Scientific Paper Writer"
    ],
    [
        "Research Writing and Publication",
        "Technical Documentation Writer"
    ],
    [
        "Research Writing and Publication",
        "Academic Writing Agent"
    ],
    [
        "Research Writing and Publication",
        "Executive Summary Agent"
    ],
    [
        "Research Writing and Publication",
        "Research Presentation Agent"
    ],
    [
        "Research Writing and Publication",
        "Research Diagram Generator"
    ],
    [
        "Research Writing and Publication",
        "Technical Illustration Agent"
    ],
    [
        "Research Writing and Publication",
        "Research Table Generator"
    ],
    [
        "Research Writing and Publication",
        "Citation Formatting Agent"
    ],
    [
        "Research Writing and Publication",
        "Bibliography Manager"
    ],
    [
        "Research Writing and Publication",
        "Report Reviewer"
    ],
    [
        "Research Writing and Publication",
        "Publication Quality Agent"
    ],
    [
        "Research Writing and Publication",
        "Research Translation Agent"
    ],
    [
        "Research Writing and Publication",
        "Document Export Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Research Memory Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Long-Term Knowledge Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Research History Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Knowledge Graph Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Document Indexing Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Semantic Search Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Knowledge Retrieval Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Research Relationship Discovery Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Cross-Research Connection Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Knowledge Deduplication Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Research Archive Agent"
    ],
    [
        "Research Memory and Knowledge Management",
        "Continuous Learning Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Research Security Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Data Privacy Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Sensitive Information Detection Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Access Control Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Research Permission Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Source Safety Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Research Compliance Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Copyright and Licensing Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Audit Trail Agent"
    ],
    [
        "Security, Privacy and Governance",
        "Research Integrity Agent"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Final Research Director Agent"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Independent Research Auditor"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Research Accuracy Evaluator"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Report Completeness Evaluator"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Evidence Coverage Evaluator"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Citation Quality Evaluator"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Research Performance Evaluator"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Final Answer Optimizer"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "User Intent Verification Agent"
    ],
    [
        "Final Intelligence and Quality Assurance",
        "Final Response Controller"
    ],
    [
        "Advanced Specialist Expansion",
        "Patent Innovation Discovery Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Research Experiment Designer"
    ],
    [
        "Advanced Specialist Expansion",
        "Peer Review Simulation Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Research Reproducibility Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Clinical Literature Research Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Geopolitical Intelligence Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Agricultural Research Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Environmental Impact Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Digital Forensics Research Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Robotics Simulation Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Space Exploration Intelligence Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Quantum Technology Intelligence Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Research Ethics Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Scientific Discovery Opportunity Agent"
    ],
    [
        "Advanced Specialist Expansion",
        "Global Knowledge Integration Agent"
    ]
]


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _build_role(division: str, name: str) -> dict[str, str]:
    focus = name.removesuffix(" Agent").removesuffix(" Writer").removesuffix(" Generator")
    if name.endswith(" Writer"):
        focus = f"{focus} writing"
    elif name.endswith(" Generator"):
        focus = f"{focus} generation"
    return {
        "id": _slug(name),
        "agent_name": f"nexora-{_slug(name)}",
        "name": name,
        "division": division,
        "focus": focus,
        "mandate": (
            f"Specialize in {focus.lower()} within the user's research question. "
            "Analyze collected evidence, distinguish sourced facts from interpretation, "
            "identify material uncertainties and contradictions, and provide domain-specific "
            "implications. Do not invent sources, measurements, citations, or conclusions; "
            "do not perform duplicate searches or write the final report."
        ),
    }


SPECIALIST_ROLES = [_build_role(division, name) for division, name in SPECIALIST_ROLE_ROWS]
