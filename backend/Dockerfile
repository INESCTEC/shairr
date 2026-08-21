FROM python:3.13.5

RUN apt update
RUN apt install ca-certificates curl -y
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
RUN chmod a+r /etc/apt/keyrings/docker.asc

# Install Java (OpenJDK by default)
RUN apt update && \
    apt install default-jre  ca-certificates curl -y

# Nextflow Installation
RUN curl -s https://get.nextflow.io | bash && \
    chmod +x nextflow && \
    mv nextflow /usr/bin/

# Add the repository to Apt sources:
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

RUN apt update

RUN apt install -y docker-ce-cli docker-compose-plugin

RUN rm -rf /var/lib/apt/lists/*

# Application setup
WORKDIR /app

COPY . /app
RUN python3 -m pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "log_conf.yaml"]