using Microsoft.EntityFrameworkCore;
using Redline.Data;

var builder = WebApplication.CreateBuilder(args);

// Adiciona os serviços essenciais (Swagger para testarmos a API depois)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Aqui pegamos a string de conexão do appsettings.json e injetamos o EF Core
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Configura a interface visual do Swagger no ambiente de desenvolvimento
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Uma rota de teste simples para garantir que a API está viva
app.MapGet("/", () => "API da Redline está online e conectada!");

app.Run();